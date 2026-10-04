import assert from "node:assert/strict";

/**
 * MySQL driver error codes, so an unrelated failure (a dropped connection, a
 * typo in the statement) cannot pass as the constraint violation a case is
 * actually about.
 */
export const FK_MISSING_ROW = "ER_NO_REFERENCED_ROW_2";
export const UNIQUE_VIOLATION = "ER_DUP_ENTRY";
export const CHECK_VIOLATION = "ER_CHECK_CONSTRAINT_VIOLATED";

/** Drizzle surfaces the driver error itself or wrapped in `cause`. */
export function driverCode(error: unknown): string | undefined {
  const candidate = (error ?? {}) as { code?: unknown; cause?: { code?: unknown } };
  if (typeof candidate.code === "string") return candidate.code;
  if (typeof candidate.cause?.code === "string") return candidate.cause.code;
  return undefined;
}

export function rejectsWithCode(query: Promise<unknown>, expected: string, message: string) {
  return assert.rejects(query, (error: unknown) => {
    assert.equal(
      driverCode(error),
      expected,
      `${message} (received: ${driverCode(error) ?? String(error)})`
    );
    return true;
  });
}
