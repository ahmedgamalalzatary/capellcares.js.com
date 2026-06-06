/**
 * Detects MySQL duplicate-key violations (ER_DUP_ENTRY), which drizzle/mysql2
 * may surface either directly or wrapped under `cause`, by code or message.
 */
export function isDuplicateEntryError(error: unknown) {
  const candidate = error as
    | { code?: string; message?: string; cause?: { code?: string; message?: string } }
    | undefined;

  return (
    candidate?.code === "ER_DUP_ENTRY" ||
    candidate?.cause?.code === "ER_DUP_ENTRY" ||
    candidate?.message?.includes("Duplicate entry") ||
    candidate?.cause?.message?.includes("Duplicate entry")
  );
}
