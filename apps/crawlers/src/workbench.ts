import { z } from "zod";

export type ValidationFailure = {
  code: "unsupported_contract_version" | "invalid_input";
  issues: Array<{ code: string; path: Array<string | number> }>;
};

/** Pure validation only: it does not authorize, probe, parse, or persist. */
export function validateEnvelope<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; error: ValidationFailure } {
  if (
    input !== null &&
    typeof input === "object" &&
    "contract_version" in input &&
    typeof input.contract_version === "string" &&
    input.contract_version !== "v1"
  ) {
    return {
      ok: false,
      error: { code: "unsupported_contract_version", issues: [] },
    };
  }
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: {
      code: "invalid_input",
      issues: result.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.map((part) =>
          typeof part === "number" ? part : String(part),
        ),
      })),
    },
  };
}
