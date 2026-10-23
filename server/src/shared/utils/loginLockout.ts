import type { FilterQuery, Model, Types, UpdateQuery } from "mongoose";
import { env } from "../../config/env";

/**
 * Account lockout after too many wrong passwords (students and admins), safe
 * under parallel requests. Each try is taken atomically BEFORE the password
 * is checked, so a burst of simultaneous guesses can't all read the same
 * count and slip past it: at most MAX_LOGIN_ATTEMPTS wrong passwords per
 * lockout, however they arrive. A right password clears the count.
 */
interface Lockable {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Takes one of the account's tries. Null while it's locked; otherwise whether
 * this is the last one (a wrong password now locks the account).
 */
export async function takeLoginAttempt<T extends Lockable>(
  model: Model<T>,
  id: Types.ObjectId,
): Promise<{ last: boolean } | null> {
  // A lockout that has run out starts the count afresh.
  await model.updateOne(
    { _id: id, lockedUntil: { $ne: null, $lte: new Date() } } as FilterQuery<T>,
    { $set: { lockedUntil: null, failedLoginAttempts: 0 } } as UpdateQuery<T>,
  );
  const taken = await model
    .findOneAndUpdate(
      {
        _id: id,
        lockedUntil: null,
        failedLoginAttempts: { $lt: env.MAX_LOGIN_ATTEMPTS },
      } as FilterQuery<T>,
      { $inc: { failedLoginAttempts: 1 } } as UpdateQuery<T>,
      { new: true, projection: { failedLoginAttempts: 1 } },
    )
    .lean<Lockable>();
  if (!taken) {
    // Parallel guesses used up the last tries before this one.
    await lockAccount(model, id);
    return null;
  }
  return { last: taken.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS };
}

/** Locks the account for LOGIN_LOCKOUT_MINUTES (an existing lock is left as is). */
export async function lockAccount<T extends Lockable>(
  model: Model<T>,
  id: Types.ObjectId,
): Promise<void> {
  await model.updateOne(
    { _id: id, lockedUntil: null } as FilterQuery<T>,
    {
      $set: {
        lockedUntil: new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60 * 1000),
      },
    } as UpdateQuery<T>,
  );
}

/** A right password: the tries start over. */
export async function clearLoginAttempts<T extends Lockable>(
  model: Model<T>,
  id: Types.ObjectId,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await model.updateOne(
    { _id: id } as FilterQuery<T>,
    { $set: { failedLoginAttempts: 0, lockedUntil: null, ...extra } } as UpdateQuery<T>,
  );
}
