import axios from "axios";
import { logger } from "./logger";

/**
 * Retrying a call to n8n is only safe when the request provably never started
 * a workflow — otherwise a retry would run it twice (two chat replies, two
 * exams, the AI credit charged twice). That is the case when the connection
 * itself could not be made (n8n restarting, DNS blip, network down) or when the
 * proxy in front of n8n answers 502/503 because nothing is listening behind it.
 *
 * A timeout, a reset in the middle of a request, a 504 or a 500 are NOT safe:
 * n8n may well be running the workflow right now.
 */
const NEVER_REACHED_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

export function neverReachedTheWorkflow(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status !== undefined) return status === 502 || status === 503;
  return err.code !== undefined && NEVER_REACHED_CODES.has(err.code);
}

/** Wait times between attempts. ~1 minute in total: enough for n8n to restart. */
export const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000];

/**
 * Runs `attempt`; while it fails in a way that is safe to retry (see above),
 * waits and tries again. Any other failure — and the last failure once the
 * delays run out — is thrown unchanged, so callers keep their own error
 * mapping.
 */
export async function withSafeRetry<T>(
  label: string,
  attempt: () => Promise<T>,
  delaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<T> {
  for (let tries = 0; ; tries++) {
    try {
      return await attempt();
    } catch (err) {
      if (tries >= delaysMs.length || !neverReachedTheWorkflow(err)) throw err;
      logger.warn(`[safe-retry] ${label} could not reach n8n, retrying`, {
        attempt: tries + 1,
        waitMs: delaysMs[tries],
        code: axios.isAxiosError(err)
          ? (err.code ?? err.response?.status)
          : undefined,
      });
      await new Promise((resolve) => setTimeout(resolve, delaysMs[tries]));
    }
  }
}
