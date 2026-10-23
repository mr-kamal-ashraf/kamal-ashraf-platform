import axios, { type AxiosInstance } from "axios";
import { env } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";

// Singleton Axios instance — created once and reused across all requests
// to avoid the overhead of re-constructing headers on every API call.
let cachedClient: AxiosInstance | null = null;

/**
 * Returns a configured Axios client for the Bunny Stream API.
 * The client targets the library defined in BUNNY_LIBRARY_ID and
 * authenticates every request with the BUNNY_API_KEY header.
 */
export function getBunnyClient(): AxiosInstance {
  if (cachedClient) return cachedClient;

  if (!env.BUNNY_API_KEY || !env.BUNNY_LIBRARY_ID) {
    throw ApiError.internal(
      "خدمة الفيديو مش متاحة حالياً، حاول تاني بعدين."
    );
  }

  cachedClient = axios.create({
    baseURL: `https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}`,
    headers: {
      AccessKey: env.BUNNY_API_KEY,
      Accept: "application/json",
    },
    timeout: 60_000,
  });

  return cachedClient;
}

/**
 * Returns true only when all four required Bunny environment variables are set.
 * Used as a guard before any Bunny API call or signed-URL generation so we
 * get a clear error instead of a cryptic 401 from Bunny.
 */
export function isBunnyConfigured(): boolean {
  return !!(
    env.BUNNY_API_KEY &&
    env.BUNNY_LIBRARY_ID &&
    env.BUNNY_PULL_ZONE &&
    env.BUNNY_TOKEN_AUTH_KEY
  );
}
