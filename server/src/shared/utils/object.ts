/**
 * The same object without its undefined fields — so applying a partial update
 * (Object.assign) never blanks a stored field that was sent empty on purpose.
 */
export function withoutUndefined<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
