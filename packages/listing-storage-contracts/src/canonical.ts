/** Reject unpaired UTF-16 surrogates; no normalization of valid Unicode occurs. */
function validUnicode(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError("Unpaired UTF-16 surrogate");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError("Unpaired UTF-16 surrogate");
    }
  }
}

/** Canonical v1 JSON preimage; callers validate their domain schema separately. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function serialize(item: unknown): string {
    if (item === null) return "null";
    if (typeof item === "string") {
      validUnicode(item);
      return JSON.stringify(item);
    }
    if (typeof item === "boolean") return item ? "true" : "false";
    if (typeof item === "number") {
      if (!Number.isSafeInteger(item) || Object.is(item, -0))
        throw new TypeError("Expected safe integer");
      return JSON.stringify(item);
    }
    if (typeof item !== "object")
      throw new TypeError("Unsupported canonical JSON value");
    if (ancestors.has(item)) throw new TypeError("Cyclic canonical JSON value");
    ancestors.add(item);
    try {
      if (Array.isArray(item)) {
        const values: string[] = [];
        for (let index = 0; index < item.length; index += 1) {
          if (!Object.hasOwn(item, index))
            throw new TypeError("Sparse canonical JSON array");
          values.push(serialize(item[index]));
        }
        return `[${values.join(",")}]`;
      }
      if (
        Object.getPrototypeOf(item) !== Object.prototype &&
        Object.getPrototypeOf(item) !== null
      )
        throw new TypeError("Expected plain JSON object");
      if (Object.getOwnPropertySymbols(item).length)
        throw new TypeError("Symbol keys are not JSON");
      const record = item as Record<string, unknown>;
      // Direct serialization preserves UTF-16 sorting even for integer-like keys.
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${serialize(key)}:${serialize(record[key])}`)
        .join(",")}}`;
    } finally {
      ancestors.delete(item);
    }
  }
  return serialize(value);
}

/** Use only for schema-declared sets. Semantic arrays must retain input order. */
export function canonicalSet<T>(values: readonly T[]): T[] {
  const keyed = values.map((value) => ({
    value,
    canonical: canonicalJson(value),
  }));
  keyed.sort((left, right) =>
    left.canonical < right.canonical
      ? -1
      : left.canonical > right.canonical
        ? 1
        : 0,
  );
  for (let index = 1; index < keyed.length; index += 1) {
    if (keyed[index]!.canonical === keyed[index - 1]!.canonical)
      throw new TypeError("Duplicate canonical set member");
  }
  return keyed.map(({ value }) => value);
}
