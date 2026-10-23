import mongoose from "mongoose";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import {
  AiJob,
  type AiJobError,
  type AiJobKind,
  type IAiJob,
} from "./ai-job.model";
import { ChatMessage } from "./chat-message.model";

/**
 * Runs slow AI requests (student chat, exam generation) in the background and
 * lets the browser collect the result with short requests. See ai-job.model.ts
 * for why. The browser never holds a connection open for the duration of the
 * work, so a proxy, a phone network or a closed tab cannot make it fail.
 *
 * Failure handling, in short:
 *  - the work itself runs here, with no practical time limit (the n8n call has
 *    its own very generous one) and safe retries when n8n is briefly down;
 *  - while a job runs, the process that owns it refreshes `heartbeatAt`. If
 *    that stops (the process was restarted) another request notices and either
 *    recovers the result (a chat answer is saved by n8n itself) or reports the
 *    interruption right away instead of leaving the user waiting.
 */

const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const HEARTBEAT_EVERY_MS = 20_000;
/** No heartbeat for this long = the process running the job is gone. */
const HEARTBEAT_STALE_MS = 75_000;
/** A chat whose runner died may still be answered by n8n — wait this long for it. */
const CHAT_RECOVERY_WINDOW_MS = 12 * 60 * 1000;
/**
 * How often a waiting request re-reads the job when nothing wakes it up. A job
 * that finishes in THIS process wakes its waiters at once (see `wakeWaiters`),
 * so this only matters for a job run by another instance or one that was cut off.
 * It stays long on purpose: every waiting student costs one Mongo read per step.
 */
const POLL_STEP_MS = 3_000;
/** Longest a single "is it done?" request may wait. Kept under common proxy idle limits. */
export const MAX_POLL_WAIT_MS = 25_000;

const activeJobs = new Set<string>();

export function activeJobCount(): number {
  return activeJobs.size;
}

/** Lets a graceful shutdown give running jobs a chance to finish. */
export async function waitForActiveJobs(maxMs: number): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (activeJobs.size > 0 && Date.now() < deadline) {
    await sleep(250);
  }
}

export type PublicJob =
  | { status: "running" }
  | { status: "done"; result: unknown }
  | { status: "failed"; error: AiJobError };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Requests waiting on a job, by job id: woken the moment this process finishes it. */
const waiters = new Map<string, Set<() => void>>();

function wakeWaiters(id: string): void {
  for (const wake of [...(waiters.get(id) ?? [])]) wake();
}

/** Sleeps `ms`, or less if the job finishes in this process in the meantime. */
function sleepOrWake(id: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const set = waiters.get(id) ?? new Set<() => void>();
    waiters.set(id, set);
    const wake = () => {
      clearTimeout(timer);
      set.delete(wake);
      if (set.size === 0) waiters.delete(id);
      resolve();
    };
    const timer = setTimeout(wake, ms);
    set.add(wake);
  });
}

function toJobError(err: unknown): AiJobError {
  if (err instanceof ApiError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message };
  }
  logger.error("[ai-jobs] job failed with an unexpected error", { err });
  return {
    statusCode: 500,
    code: "AI_JOB_FAILED",
    message: "حصلت مشكلة في المساعد الذكي، حاول تاني.",
  };
}

/** Writes the outcome; retries a couple of times so a Mongo blip cannot lose it. */
async function finish(
  id: string,
  set: Partial<Pick<IAiJob, "status" | "result" | "error">>,
): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await AiJob.updateOne(
        { _id: id, status: "running" },
        { $set: { ...set, finishedAt: new Date() } },
      );
      return;
    } catch (err) {
      logger.error("[ai-jobs] could not save a job's outcome", {
        id,
        attempt,
        err,
      });
      await sleep(500 * attempt);
    }
  }
}

async function runJob(id: string, work: () => Promise<unknown>): Promise<void> {
  const beat = setInterval(() => {
    AiJob.updateOne(
      { _id: id, status: "running" },
      { $set: { heartbeatAt: new Date() } },
    ).catch(() => undefined);
  }, HEARTBEAT_EVERY_MS);
  beat.unref();
  try {
    const result = await work();
    await finish(id, { status: "done", result });
  } catch (err) {
    await finish(id, { status: "failed", error: toJobError(err) });
  } finally {
    clearInterval(beat);
    activeJobs.delete(id);
    wakeWaiters(id);
  }
}

/**
 * Registers a job and starts `work` in the background. Resolves with the job id
 * as soon as the row exists — it does NOT wait for the work.
 */
export async function startAiJob(opts: {
  kind: AiJobKind;
  ownerId: string;
  conversationId?: string;
  work: () => Promise<unknown>;
}): Promise<string> {
  const now = Date.now();
  const doc = await AiJob.create({
    kind: opts.kind,
    ownerId: opts.ownerId,
    status: "running",
    meta: opts.conversationId
      ? { conversationId: opts.conversationId }
      : undefined,
    heartbeatAt: new Date(now),
    expiresAt: new Date(now + JOB_TTL_MS),
  });
  const id = String(doc._id);
  activeJobs.add(id);
  void runJob(id, opts.work);
  return id;
}

function toPublic(job: Pick<IAiJob, "status" | "result" | "error">): PublicJob {
  if (job.status === "done") return { status: "done", result: job.result };
  if (job.status === "failed") {
    return {
      status: "failed",
      error: job.error ?? {
        statusCode: 500,
        code: "AI_JOB_FAILED",
        message: "حصلت مشكلة في المساعد الذكي، حاول تاني.",
      },
    };
  }
  return { status: "running" };
}

type JobRow = IAiJob & { _id: unknown };

const INTERRUPTED: AiJobError = {
  statusCode: 503,
  code: "AI_JOB_INTERRUPTED",
  message: "السيرفر اتعمله إعادة تشغيل وإنت مستني الرد. ابعت طلبك تاني.",
};

/**
 * A job still marked "running" whose owner stopped sending heartbeats was cut off
 * (the platform was restarted). Chat: n8n keeps working and saves the assistant's
 * reply itself, so look for it. Anything else: say so right away.
 */
async function reconcileOrphan(job: JobRow): Promise<JobRow> {
  const id = String(job._id);
  if (activeJobs.has(id)) return job;
  if (Date.now() - new Date(job.heartbeatAt).getTime() < HEARTBEAT_STALE_MS)
    return job;

  let outcome: Pick<IAiJob, "status" | "result" | "error"> | null = null;

  if (job.kind === "student_chat" && job.meta?.conversationId) {
    const latest = await ChatMessage.find({
      participantId: job.ownerId,
      conversationId: job.meta.conversationId,
      role: "assistant",
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    // n8n stores createdAt as an ISO string, so compare in code, not in the query.
    const since = new Date(job.createdAt).getTime() - 1_000;
    const answer = latest.find((m) => Date.parse(String(m.createdAt)) >= since);
    if (answer) {
      outcome = {
        status: "done",
        result: {
          reply: answer.content ?? "",
          conversation_id: job.meta.conversationId,
          was_blocked: Boolean(answer.wasBlocked),
        },
      };
    } else if (
      Date.now() - new Date(job.createdAt).getTime() >
      CHAT_RECOVERY_WINDOW_MS
    ) {
      outcome = { status: "failed", error: INTERRUPTED };
    }
  } else {
    outcome = { status: "failed", error: INTERRUPTED };
  }

  if (!outcome) return job;
  const updated = await AiJob.findOneAndUpdate(
    { _id: id, status: "running" },
    { $set: { ...outcome, finishedAt: new Date() } },
    { new: true },
  ).lean();
  // Someone else finished it first: read what they wrote.
  return (updated ?? (await AiJob.findById(id).lean()) ?? job) as JobRow;
}

/**
 * The job's current state, waiting up to `waitMs` for it to finish (long
 * polling: the answer comes back the moment it is ready, and a slow job costs
 * the browser only a few requests). `null` when there is no such job for this
 * owner — a job is only visible to the person who started it.
 */
export async function waitForJob(opts: {
  kind: AiJobKind;
  ownerId: string;
  jobId: string;
  waitMs: number;
}): Promise<PublicJob | null> {
  if (!mongoose.isValidObjectId(opts.jobId)) return null;
  const deadline =
    Date.now() + Math.min(Math.max(opts.waitMs, 0), MAX_POLL_WAIT_MS);

  for (;;) {
    let job = (await AiJob.findOne({
      _id: opts.jobId,
      kind: opts.kind,
      ownerId: opts.ownerId,
    }).lean()) as JobRow | null;
    if (!job) return null;
    if (job.status === "running") job = await reconcileOrphan(job);
    const remaining = deadline - Date.now();
    if (job.status !== "running" || remaining <= 0) return toPublic(job);
    await sleepOrWake(opts.jobId, Math.min(POLL_STEP_MS, remaining));
  }
}
