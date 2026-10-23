import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async route handler so that any rejected promise or thrown error
 * is automatically forwarded to Express's next() function (and therefore
 * picked up by the global error middleware).
 *
 * Without this wrapper every async controller would need its own try/catch:
 *   router.get("/", async (req, res, next) => { try { ... } catch(e){ next(e) } })
 *
 * With this wrapper:
 *   router.get("/", asyncHandler(myController))
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    // Run the handler; if it throws or rejects, pass the error to next().
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
