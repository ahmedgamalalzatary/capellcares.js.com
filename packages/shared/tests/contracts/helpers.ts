import assert from "node:assert/strict";
import type { ZodSchema } from "zod";

export function assertConformsTo<T>(dto: unknown, schema: ZodSchema<T>) {
  const result = schema.safeParse(dto);
  assert.equal(result.success, true, result.success ? undefined : result.error.message);
}

export function assertForbiddenFieldsAbsent(dto: unknown, forbiddenFields: string[]) {
  const inspect = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    for (const field of forbiddenFields) {
      assert.equal(field in (value as Record<string, unknown>), false, `Forbidden field present: ${field}`);
    }

    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(nested)) {
        nested.forEach(inspect);
      } else {
        inspect(nested);
      }
    }
  };

  inspect(dto);
}
