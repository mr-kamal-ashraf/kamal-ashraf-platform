import type { Role } from "../../config/constants";

/**
 * Extends Express's built-in Request interface to add a `user` property.
 *
 * This is set by the `authenticate()` middleware after a valid JWT is verified.
 * Any route handler that runs after that middleware can safely read req.user
 * without TypeScript complaining that the property doesn't exist.
 *
 * - id:        the authenticated user's MongoDB ObjectId as a string.
 * - role:      "student" or "admin" — used for role-based access checks.
 * - sessionId: the DB session record ID; present for all authenticated requests
 *              and used to revoke the session on logout or password change.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        sessionId?: string;
      };
    }
  }
}

export {};
