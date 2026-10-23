import { apiClient, createApiError, isApiError } from "./client";

/**
 * Slow AI requests (a student's question, an exam) are run by the backend as
 * background jobs: the POST answers at once with a job id, and the result is
 * collected here with short requests. Nothing depends on one connection staying
 * open for as long as the AI takes, so a proxy, a flaky phone network or a
 * brief server restart cannot make the request fail.
 *
 * The functions built on this keep their original signature and result type,
 * so the screens that call them did not have to change. And an older backend
 * that still answers the POST directly keeps working: its answer is returned
 * as it is.
 */

interface JobStarted {
  job_id: string;
  status: "running";
}

type JobPoll<T> =
  | { status: "running" }
  | { status: "done"; result: T }
  | {
      status: "failed";
      error: { statusCode: number; code?: string; message: string };
    };

/** How long one "is it done?" request may be held open by the server. */
const POLL_WAIT_MS = 20_000;
/**
 * While the job is running we keep asking, however long it takes: the server
 * decides when a job has failed. We only give up when the server itself has
 * been unreachable for this long in a row.
 */
const GIVE_UP_OFFLINE_AFTER_MS = 30 * 60 * 1000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 10_000];
/**
 * Two "is it done?" requests are never closer than this. A normal poll is held
 * by the server for up to POLL_WAIT_MS, so this only matters if some server or
 * proxy answers "still running" at once: without it we would ask in a hot loop.
 */
const MIN_POLL_GAP_MS = 1_000;

function isJobStarted(value: unknown): value is JobStarted {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { job_id?: unknown }).job_id === "string"
  );
}

/** The failure is about getting through to the server, not about the job. */
function isConnectionProblem(err: unknown): boolean {
  return (
    isApiError(err) &&
    (err.code === "NETWORK_ERROR" || [502, 503, 504].includes(err.statusCode))
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function abortedError() {
  return createApiError("تم إلغاء الطلب.", 0, "REQUEST_ABORTED");
}

export async function runAsyncJob<T>(opts: {
  /** Sends the request (with `?async=1`). */
  start: () => Promise<T | JobStarted>;
  /** Where the state of job `id` is read. */
  pollEndpoint: (id: string) => string;
  signal?: AbortSignal;
}): Promise<T> {
  const started = await opts.start();
  // An older backend answered directly: that IS the result.
  if (!isJobStarted(started)) return started;

  const { signal } = opts;
  let connectionFailures = 0;
  let offlineSince = 0;

  for (;;) {
    if (signal?.aborted) throw abortedError();

    let job: JobPoll<T>;
    const askedAt = Date.now();
    try {
      job = await apiClient.get<JobPoll<T>>(opts.pollEndpoint(started.job_id), {
        query: { wait: POLL_WAIT_MS },
        signal,
      });
      connectionFailures = 0;
      offlineSince = 0;
    } catch (err) {
      // The job keeps running on the server while we are offline: wait a little
      // and ask again, instead of reporting a failure that did not happen.
      if (isConnectionProblem(err)) {
        if (!offlineSince) offlineSince = Date.now();
        if (Date.now() - offlineSince >= GIVE_UP_OFFLINE_AFTER_MS) throw err;
        const wait =
          RETRY_DELAYS_MS[
            Math.min(connectionFailures, RETRY_DELAYS_MS.length - 1)
          ];
        connectionFailures += 1;
        await sleep(wait, signal);
        continue;
      }
      throw err;
    }

    if (job.status === "done") return job.result;
    if (job.status === "failed") {
      throw createApiError(
        job.error.message,
        job.error.statusCode,
        job.error.code,
      );
    }
    // Still running: the server already waited up to POLL_WAIT_MS, ask again.
    const sinceAsked = Date.now() - askedAt;
    if (sinceAsked < MIN_POLL_GAP_MS)
      await sleep(MIN_POLL_GAP_MS - sinceAsked, signal);
  }
}
