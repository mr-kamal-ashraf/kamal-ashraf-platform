import type { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

// Where in the request to read input from.
type Source = "body" | "query" | "params";

/**
 * Express middleware factory that validates part of the request against a Zod schema.
 *
 * On failure: passes the ZodError to next() — the global error middleware
 * catches it and returns a 422 Unprocessable Entity response.
 *
 * On success: replaces req.body (or req.params) with the parsed+coerced data
 * so downstream handlers always receive clean, typed values.
 *
 * Usage:
 *   router.post("/", validate(createLessonSchema), handler)
 *   router.get("/",  validate(querySchema, "query"), handler)
 */
export function validate(schema: ZodSchema, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      // Pass the ZodError to the global error handler which formats it as 422.
      return next(result.error);
    }
    // Replace the raw request data with the Zod-parsed (and potentially transformed) data.
    if (source === "body") {
      req.body = result.data;
    } else if (source === "params") {
      req.params = result.data as Request["params"];
    }
    // For query strings we intentionally do NOT rewrite req.query because
    // Express makes it read-only; the validated data is on result.data instead.
    next();
  };
}
