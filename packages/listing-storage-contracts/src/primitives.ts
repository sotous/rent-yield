import { z } from "zod";

export const contractVersionSchema = z.literal("v1");
export const identifierSchema = z.string().min(1).max(256);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const listingRoleSchema = z.enum(["for_sale", "for_rent"]);
export const capabilitySchema = z.enum([
  "discovery",
  "detail",
  "rental_evidence",
]);
export const safeNonNegativeIntegerSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)
  .refine((value) => !Object.is(value, -0));

/** Canonical decimal text preserves precision without converting to a JS number. */
export const decimalSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/)
  .refine((value) => value !== "-0");
export const positiveDecimalSchema = decimalSchema.refine(
  (value) => value !== "0" && !value.startsWith("-"),
);

export const instantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  });
const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => instantSchema.safeParse(`${value}T00:00:00.000Z`).success);
const monthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const yearSchema = z.string().regex(/^\d{4}$/);
const sourceDateBase = {
  raw_text: z.string(),
  timezone_assumption: z.string().min(1).nullable().optional(),
};
export const sourceDateSchema = z.discriminatedUnion("precision", [
  z.strictObject({
    ...sourceDateBase,
    precision: z.literal("instant"),
    value: instantSchema,
  }),
  z.strictObject({
    ...sourceDateBase,
    precision: z.literal("day"),
    value: daySchema,
  }),
  z.strictObject({
    ...sourceDateBase,
    precision: z.literal("month"),
    value: monthSchema,
  }),
  z.strictObject({
    ...sourceDateBase,
    precision: z.literal("year"),
    value: yearSchema,
  }),
  z.strictObject({ ...sourceDateBase, precision: z.literal("unknown") }),
]);

/** Codes and paths are sanitized diagnostics, not raw source payloads. */
export const qualityIssueSchema = z.strictObject({
  code: identifierSchema,
  path: z.string().optional(),
  severity: z.enum(["warning", "error"]),
});
