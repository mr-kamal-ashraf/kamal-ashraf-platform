import http from "http";
import https from "https";

/**
 * Agents that open a NEW connection for every request (no keep-alive reuse).
 *
 * Node reuses idle connections by default. After n8n restarts, the platform
 * still holds sockets to the old process: the first request that picks one up
 * dies with ECONNRESET although n8n was never reached — a failure that cannot
 * be retried safely, because a reset in the middle of a request may mean the
 * workflow is already running. The n8n calls are few and long (seconds to
 * minutes), so a fresh connection costs nothing next to them and removes the
 * whole class of stale-socket failures.
 *
 * Long waits: axios already turns on TCP keep-alive probes for every request
 * socket (first probe after 60 s of silence — see axios/lib/adapters/http.js).
 * That is what keeps a connection that carries no bytes for minutes from being
 * dropped by a firewall or NAT between two servers, and what makes a dead n8n
 * show up as a connection error. Together with having no time limit on the
 * call, the platform waits for as long as n8n is alive.
 */
export const freshConnections = {
  httpAgent: new http.Agent({ keepAlive: false }),
  httpsAgent: new https.Agent({ keepAlive: false }),
};
