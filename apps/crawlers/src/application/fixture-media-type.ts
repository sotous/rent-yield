export const fixtureMediaTypes = [
  "application/json",
  "text/html",
  "text/plain",
] as const;

export type FixtureMediaType = (typeof fixtureMediaTypes)[number];

/** Returns a fixture-safe base media type, ignoring response parameters. */
export function normalizeFixtureMediaType(
  value: string | null,
): FixtureMediaType | null {
  const baseType = value?.split(";", 1)[0]?.trim().toLowerCase();
  return fixtureMediaTypes.find((type) => type === baseType) ?? null;
}
