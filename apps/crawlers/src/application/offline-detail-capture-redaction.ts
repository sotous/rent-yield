import { createHash } from "node:crypto";
import { parseFragment } from "parse5";

type HtmlNode = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

type SafeDetailClaims = {
  source_listing_id: string | null;
  listing_url: string | null;
  listing_role: "for_rent" | null;
  asking_amount: string | null;
  currency: "COP" | null;
  frequency: "monthly" | null;
  fee_scope: "base" | null;
  built_area_sqm: string | null;
  property_type: "apartment" | "house" | "studio" | "other_residential" | null;
  rental_basis: "long_term" | null;
  listing_status: "active" | null;
  city: string | null;
  area: string | null;
};

type ClaimKey = keyof SafeDetailClaims;
type ClaimValue = Exclude<SafeDetailClaims[ClaimKey], null>;
type DiagnosticOutcome =
  | "unique"
  | "ambiguous_or_invalid"
  | "no_adjacent_value"
  | "script_only"
  | "no_matching_label";

type FieldDiagnostic = {
  recognized_label_count: number;
  adjacent_element_count: number;
  parseable_value_count: number;
  outcome: DiagnosticOutcome;
};

export type OfflineDetailCaptureRedactionResult =
  | {
      ok: true;
      receipt: { original_bytes_sha256: string; byte_length: number };
      claims: SafeDetailClaims;
      diagnostic: { fields: Record<ClaimKey, FieldDiagnostic> };
    }
  | { ok: false; error: { code: "invalid_utf8" } };

const emptyClaims = (): SafeDetailClaims => ({
  source_listing_id: null,
  listing_url: null,
  listing_role: null,
  asking_amount: null,
  currency: null,
  frequency: null,
  fee_scope: null,
  built_area_sqm: null,
  property_type: null,
  rental_basis: null,
  listing_status: null,
  city: null,
  area: null,
});

const ignoredTags = new Set(["script", "style", "noscript", "template"]);

const fieldsForLabel: Record<string, ClaimKey[]> = {
  "canon de arrendamiento": ["asking_amount", "currency", "frequency"],
  "valor de arrendamiento": ["asking_amount", "currency", "frequency"],
  "precio de arriendo": ["asking_amount", "currency", "frequency"],
  "precio de arrendamiento": ["asking_amount", "currency", "frequency"],
  "area construida": ["built_area_sqm"],
  "tipo de inmueble": ["property_type"],
  operacion: ["listing_role"],
  "tipo de operacion": ["listing_role"],
  ciudad: ["city"],
  barrio: ["area"],
  zona: ["area"],
  "codigo del inmueble": ["source_listing_id"],
  "codigo inmueble": ["source_listing_id"],
  "tipo de arriendo": ["rental_basis"],
  "estado de publicacion": ["listing_status"],
};

const normalizedText = (value: string): string =>
  value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();

const canonicalLabel = (value: string): string =>
  normalizedText(value).toLowerCase();

function visibleText(node: HtmlNode): string {
  if (node.tagName && ignoredTags.has(node.tagName)) return "";
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(visibleText).join(" ");
}

function rawText(node: HtmlNode): string {
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(rawText).join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function typedAs(value: Record<string, unknown>, type: string): boolean {
  return asArray(value["@type"]).some(
    (candidate) => typeof candidate === "string" && candidate === type,
  );
}

function scriptType(node: HtmlNode): string | null {
  const type = node.attrs?.find(
    (attribute) => attribute.name.toLowerCase() === "type",
  )?.value;
  return type?.split(";", 1)[0]?.trim().toLowerCase() ?? null;
}

function normalizePositiveDecimal(value: string): string | null {
  const compact = value.replace(/[.\s]/g, "");
  if (!/^\d+$/.test(compact) || /^0+$/.test(compact)) return null;
  return compact;
}

function normalizeArea(value: string): string | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)\s*$/iu.exec(value);
  if (!match?.[1]) return null;
  const decimal = match[1]
    .replace(",", ".")
    .replace(/0+$/, "")
    .replace(/\.$/, "");
  return /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(decimal) && decimal !== "0"
    ? decimal
    : null;
}

function normalizePlace(value: string): string | null {
  const normalized = normalizedText(value);
  return /^[\p{L}][\p{L} .'-]{0,127}$/u.test(normalized) ? normalized : null;
}

function normalizeStructuredDecimal(value: unknown): string | null {
  const normalized =
    typeof value === "number"
      ? Number.isFinite(value)
        ? String(value)
        : null
      : typeof value === "string"
        ? value.trim()
        : null;
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const decimal = normalized.includes(".")
    ? normalized.replace(/0+$/, "").replace(/\.$/, "")
    : normalized;
  return decimal && decimal !== "0" ? decimal : null;
}

function priceClaims(value: string): Array<[ClaimKey, ClaimValue]> {
  const normalized = normalizedText(value);
  const currency = /(?:^|\s)COP(?:\s|$)/.test(normalized) ? "COP" : null;
  const amount = normalizePositiveDecimal(
    normalized.replace(/(?:^|\s)COP(?:\s|$)/g, " ").replace(/mensual/giu, " "),
  );
  const frequency = /(?:^|\s)mensual(?:\s|$)/iu.test(normalized)
    ? "monthly"
    : null;
  const claims: Array<[ClaimKey, ClaimValue]> = [];
  if (amount) claims.push(["asking_amount", amount]);
  if (currency) claims.push(["currency", currency]);
  if (frequency) claims.push(["frequency", frequency]);
  return claims;
}

function claimsForPair(
  label: string,
  value: string,
): Array<[ClaimKey, ClaimValue]> {
  switch (label) {
    case "canon de arrendamiento":
    case "valor de arrendamiento":
    case "precio de arriendo":
    case "precio de arrendamiento":
      return priceClaims(value);
    case "area construida": {
      const area = normalizeArea(value);
      return area ? [["built_area_sqm", area]] : [];
    }
    case "tipo de inmueble": {
      const propertyTypes: Record<string, SafeDetailClaims["property_type"]> = {
        apartamento: "apartment",
        casa: "house",
        apartaestudio: "studio",
        otro: "other_residential",
      };
      const propertyType = propertyTypes[canonicalLabel(value)];
      return propertyType ? [["property_type", propertyType]] : [];
    }
    case "operacion":
    case "tipo de operacion":
      return ["arriendo", "for_rent"].includes(canonicalLabel(value))
        ? [["listing_role", "for_rent"]]
        : [];
    case "ciudad": {
      const city = normalizePlace(value);
      return city ? [["city", city]] : [];
    }
    case "barrio":
    case "zona": {
      const area = normalizePlace(value);
      return area ? [["area", area]] : [];
    }
    case "codigo del inmueble":
    case "codigo inmueble": {
      const id = normalizedText(value);
      return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
        ? [["source_listing_id", id]]
        : [];
    }
    case "tipo de arriendo":
      return ["larga estancia", "long term"].includes(canonicalLabel(value))
        ? [["rental_basis", "long_term"]]
        : [];
    case "estado de publicacion":
      return ["activo", "disponible", "active"].includes(canonicalLabel(value))
        ? [["listing_status", "active"]]
        : [];
    default:
      return [];
  }
}

function immediatelyPairedElement(
  children: HtmlNode[],
  start: number,
): HtmlNode | null {
  for (let index = start + 1; index < children.length; index += 1) {
    const child = children[index];
    if (!child) continue;
    if (child.nodeName === "#text") {
      if ((child.value ?? "").trim() === "") continue;
      return null;
    }
    return child;
  }
  return null;
}

function collectPairs(
  node: HtmlNode,
  candidates: Map<ClaimKey, ClaimValue[]>,
  diagnostics: Map<ClaimKey, Omit<FieldDiagnostic, "outcome">>,
): void {
  const children = node.childNodes ?? [];
  for (let index = 0; index < children.length; index += 1) {
    const labelNode = children[index];
    if (!labelNode || labelNode.nodeName === "#text") continue;
    const label = canonicalLabel(visibleText(labelNode));
    const fields = fieldsForLabel[label] ?? [];
    for (const field of fields) {
      const diagnostic = diagnostics.get(field);
      if (diagnostic) diagnostic.recognized_label_count += 1;
    }
    const next = immediatelyPairedElement(children, index);
    if (!next || !label) continue;
    for (const field of fields) {
      const diagnostic = diagnostics.get(field);
      if (diagnostic) diagnostic.adjacent_element_count += 1;
    }
    for (const [field, value] of claimsForPair(label, visibleText(next))) {
      const values = candidates.get(field) ?? [];
      values.push(value);
      candidates.set(field, values);
      const diagnostic = diagnostics.get(field);
      if (diagnostic) diagnostic.parseable_value_count += 1;
    }
  }
  for (const child of children) collectPairs(child, candidates, diagnostics);
}

function collectScriptFields(node: HtmlNode, fields: Set<ClaimKey>): void {
  if (node.tagName === "script") {
    const script = canonicalLabel(rawText(node));
    for (const [label, labelFields] of Object.entries(fieldsForLabel)) {
      if (script.includes(label))
        labelFields.forEach((field) => fields.add(field));
    }
    return;
  }
  for (const child of node.childNodes ?? []) collectScriptFields(child, fields);
}

function addCandidate(
  candidates: Map<ClaimKey, ClaimValue[]>,
  field: ClaimKey,
  value: ClaimValue | null,
): void {
  if (!value) return;
  const values = candidates.get(field) ?? [];
  values.push(value);
  candidates.set(field, values);
}

function structuredPropertyClaims(
  value: Record<string, unknown>,
  candidates: Map<ClaimKey, ClaimValue[]>,
): void {
  const propertyType: SafeDetailClaims["property_type"] = typedAs(
    value,
    "Apartment",
  )
    ? "apartment"
    : typedAs(value, "House")
      ? "house"
      : null;
  if (!propertyType) return;
  addCandidate(candidates, "property_type", propertyType);
  const identifier = value.identifier;
  if (
    typeof identifier === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(identifier)
  )
    addCandidate(candidates, "source_listing_id", identifier);
  const address = value.address;
  if (isRecord(address) && typedAs(address, "PostalAddress")) {
    const city = address.addressLocality;
    if (typeof city === "string")
      addCandidate(candidates, "city", normalizePlace(city));
  }
  const floorSize = value.floorSize;
  if (isRecord(floorSize) && typedAs(floorSize, "QuantitativeValue")) {
    const unit = floorSize.unitCode;
    if (unit === "MTK")
      addCandidate(
        candidates,
        "built_area_sqm",
        normalizeStructuredDecimal(floorSize.value),
      );
  }
}

function structuredOfferClaims(
  value: Record<string, unknown>,
  candidates: Map<ClaimKey, ClaimValue[]>,
): void {
  if (!typedAs(value, "Offer")) return;
  const businessFunction = value.businessFunction;
  if (
    typeof businessFunction !== "string" ||
    !businessFunction.endsWith("#LeaseOut")
  )
    return;
  addCandidate(candidates, "listing_role", "for_rent");
  const priceSpecification = value.priceSpecification;
  const monthly =
    isRecord(priceSpecification) &&
    priceSpecification.billingDuration === "P1M";
  const price = normalizeStructuredDecimal(value.price);
  const currency = value.priceCurrency === "COP" ? "COP" : null;
  if (monthly && price && currency) {
    addCandidate(candidates, "asking_amount", price);
    addCandidate(candidates, "currency", currency);
    addCandidate(candidates, "frequency", "monthly");
  }
  if (value.availability === "https://schema.org/InStock")
    addCandidate(candidates, "listing_status", "active");
}

function collectStructuredClaims(
  value: unknown,
  candidates: Map<ClaimKey, ClaimValue[]>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredClaims(item, candidates));
    return;
  }
  if (!isRecord(value)) return;
  structuredPropertyClaims(value, candidates);
  structuredOfferClaims(value, candidates);
  Object.values(value).forEach((item) =>
    collectStructuredClaims(item, candidates),
  );
}

function collectJsonLdClaims(
  node: HtmlNode,
  candidates: Map<ClaimKey, ClaimValue[]>,
): void {
  if (node.tagName === "script" && scriptType(node) === "application/ld+json") {
    try {
      collectStructuredClaims(JSON.parse(rawText(node)) as unknown, candidates);
    } catch {
      // Malformed or unsupported structured data contributes no claims.
    }
    return;
  }
  for (const child of node.childNodes ?? [])
    collectJsonLdClaims(child, candidates);
}

function emptyDiagnostics(): Map<ClaimKey, Omit<FieldDiagnostic, "outcome">> {
  return new Map(
    (Object.keys(emptyClaims()) as ClaimKey[]).map((field) => [
      field,
      {
        recognized_label_count: 0,
        adjacent_element_count: 0,
        parseable_value_count: 0,
      },
    ]),
  );
}

function finalizeDiagnostics(
  diagnostics: Map<ClaimKey, Omit<FieldDiagnostic, "outcome">>,
  candidates: Map<ClaimKey, ClaimValue[]>,
  scriptFields: Set<ClaimKey>,
): Record<ClaimKey, FieldDiagnostic> {
  return Object.fromEntries(
    (Object.keys(emptyClaims()) as ClaimKey[]).map((field) => {
      const counts = diagnostics.get(field)!;
      const values = candidates.get(field) ?? [];
      const outcome: DiagnosticOutcome =
        values.length === 1
          ? "unique"
          : counts.recognized_label_count === 0 && scriptFields.has(field)
            ? "script_only"
            : counts.recognized_label_count === 0
              ? "no_matching_label"
              : counts.adjacent_element_count === 0
                ? "no_adjacent_value"
                : "ambiguous_or_invalid";
      return [field, { ...counts, outcome }];
    }),
  ) as Record<ClaimKey, FieldDiagnostic>;
}

/**
 * Converts transient detail HTML into a fixed safe claim bag. It recognizes
 * only a small, source-agnostic Spanish real-estate vocabulary when an exact
 * visible label has one immediately paired value. Raw HTML, labels, DOM paths,
 * scripts, JSON-LD, and unrecognized text never cross this boundary.
 */
export function redactOfflineDetailCapture(input: {
  original_bytes: Uint8Array;
}): OfflineDetailCaptureRedactionResult {
  const receipt = {
    original_bytes_sha256: createHash("sha256")
      .update(input.original_bytes)
      .digest("hex"),
    byte_length: input.original_bytes.byteLength,
  };
  try {
    let html: string;
    try {
      html = new TextDecoder("utf-8", { fatal: true }).decode(
        input.original_bytes,
      );
    } catch {
      return { ok: false, error: { code: "invalid_utf8" } };
    }
    const candidates = new Map<ClaimKey, ClaimValue[]>();
    const diagnostics = emptyDiagnostics();
    const fragment = parseFragment(html) as HtmlNode;
    collectPairs(fragment, candidates, diagnostics);
    collectJsonLdClaims(fragment, candidates);
    const scriptFields = new Set<ClaimKey>();
    collectScriptFields(fragment, scriptFields);
    const resolved = Object.keys(emptyClaims()).map((key) => {
      const typedKey = key as ClaimKey;
      const values = candidates.get(typedKey);
      return [typedKey, values?.length === 1 ? (values[0] ?? null) : null];
    });
    const claims = Object.fromEntries(resolved) as SafeDetailClaims;
    return {
      ok: true,
      receipt,
      claims,
      diagnostic: {
        fields: finalizeDiagnostics(diagnostics, candidates, scriptFields),
      },
    };
  } finally {
    input.original_bytes.fill(0);
  }
}
