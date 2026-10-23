import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Catch-all middleware registered AFTER all route definitions.
 * Any request that didn't match a route reaches this handler and gets
 * converted into a 404 ApiError, which the global error middleware then
 * formats into a standard JSON error response.
 *
 * The message is user-facing (it can end up in a toast), so it's Arabic; the
 * method + path stay available to developers in `details`. A frontend that
 * hits this usually means the server is running an older build.
 */
export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  next(
    new ApiError(404, "الخدمة دي مش موجودة على السيرفر.", {
      code: "ROUTE_NOT_FOUND",
      details: { method: req.method, path: req.originalUrl },
    })
  );
}
