import { createHash } from "node:crypto";
import {
  canonicalJson,
  canonicalSet,
  fixtureEnvelopeSchema,
  identifierSchema,
  instantSchema,
  type FixtureEnvelope,
} from "@rent-yield/listing-storage-contracts";
import { z } from "zod";

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const supportedContentTypeSchema = z.enum([
  "application/json",
  "text/html",
  "text/plain",
]);

const sourceOriginInputSchema = z.strictObject({
  kind: z.literal("permitted_source"),
  source_key: identifierSchema,
  source_url: z.string().min(1),
  collected_at: instantSchema,
  assessment_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const syntheticOriginInputSchema = z.strictObject({
  kind: z.literal("synthetic"),
  scenario: z.string().min(1).max(2048),
  generated_at: instantSchema,
});

const captureCommandSchema = z.strictObject({
  fixture_id: identifierSchema,
  supersedes_fixture_id: identifierSchema.nullable(),
  origin: z.discriminatedUnion("kind", [
    sourceOriginInputSchema,
    syntheticOriginInputSchema,
  ]),
  created_at: instantSchema,
  content_type: supportedContentTypeSchema,
  payload: z.union([z.string(), z.instanceof(Uint8Array)]),
  permitted_use: z
    .array(z.enum(["parser_replay", "evidence_audit"]))
    .min(1)
    .max(2),
  retention_policy_key: identifierSchema,
  research_session_id: identifierSchema,
  parser_compatibility: z.array(identifierSchema).min(1),
  expected_classification: z.enum([
    "normalized",
    "quarantined",
    "parse_failed",
    "capture_only",
  ]),
});

type CaptureCommand = z.infer<typeof captureCommandSchema>;
export type FixtureArtifact = {
  envelope: FixtureEnvelope;
  payload: string;
};

type InputIssue = { code: string; path: Array<string | number> };
export type FixtureCaptureError =
  | { code: "invalid_input"; issues: InputIssue[] }
  | { code: "invalid_encoding" }
  | { code: "prohibited_data"; issues: string[] }
  | { code: "identifier_conflict" }
  | { code: "invalid_supersession" }
  | { code: "integrity_mismatch" };

export type FixtureCaptureResult =
  | { ok: true; artifact: FixtureArtifact; appended: boolean }
  | { ok: false; error: FixtureCaptureError };

const redactionPolicy = {
  version: "redaction-v1",
  replacement_format: "[REDACTED:<category>]",
  sensitive_categories: [
    "address",
    "agent_id",
    "contact",
    "cookie",
    "email",
    "exact_address",
    "exact_unit",
    "identity_number",
    "image",
    "owner_id",
    "phone",
    "token",
  ],
  url_policy: "https_without_credentials_query_or_fragment",
  embedded_binary_policy: "reject",
} as const;

export const fixtureRedactionVersion = redactionPolicy.version;
export const fixtureRedactionPolicySha256 = sha256(
  canonicalJson(redactionPolicy),
);
const placeholder = (category: string) => `[REDACTED:${category}]`;

function inputIssues(error: z.ZodError): InputIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.map((part) =>
      typeof part === "number" ? part : String(part),
    ),
  }));
}

function decodeUtf8(payload: string | Uint8Array): string | null {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    if (typeof payload !== "string") return decoder.decode(payload);
    const bytes = new TextEncoder().encode(payload);
    return decoder.decode(bytes) === payload ? payload : null;
  } catch {
    return null;
  }
}

function sanitizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "")
      return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function categoryForKey(key: string): string | null {
  const normalized = key
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (
    /^(?:address|exactaddress|streetaddress|addressline|direccion|direccionexacta)$/.test(
      normalized,
    )
  )
    return "exact_address";
  if (
    /^(?:unit|unitnumber|apartment|apartmentnumber|apartamento)$/.test(
      normalized,
    )
  )
    return "exact_unit";
  if (
    /(?:agent|broker|asesor).*id|id.*(?:agent|broker|asesor)/.test(normalized)
  )
    return "agent_id";
  if (/(?:owner|propietario).*id|id.*(?:owner|propietario)/.test(normalized))
    return "owner_id";
  if (/(?:email|correo)/.test(normalized)) return "email";
  if (/(?:phone|telephone|telefono|celular|mobile|whatsapp)/.test(normalized))
    return "phone";
  if (/(?:cookie|session)/.test(normalized)) return "cookie";
  if (/(?:token|secret|password|authorization|apikey)/.test(normalized))
    return "token";
  if (/(?:cedula|identitynumber|documentnumber|nationalid)/.test(normalized))
    return "identity_number";
  if (/(?:gallery|image|imagen|photo|foto)/.test(normalized)) return "image";
  if (
    /(?:agent|agente|broker|asesor|owner|propietario).*name|name.*(?:agent|agente|broker|asesor|owner|propietario)/.test(
      normalized,
    )
  )
    return "contact";
  if (
    /^(?:contact|contactinfo|contacto|agent|agente|broker|asesor|owner|propietario|auth)$/.test(
      normalized,
    )
  )
    return "contact";
  return null;
}

function redactUrlText(value: string): string {
  return value.replace(/https:\/\/[^\s"'<>]+/giu, (candidate) => {
    const sanitized = sanitizeUrl(candidate);
    return sanitized ?? placeholder("url");
  });
}

function redactFreeText(value: string): string {
  let redacted = redactUrlText(value);
  redacted = redacted.replace(
    /[A-Z0-9._%+-]+(?:&#0*64;|&commat;)[A-Z0-9.-]+\.[A-Z]{2,}/giu,
    placeholder("email"),
  );
  redacted = redacted.replace(
    /mailto:[^\s"'<>]+/giu,
    `mailto:${placeholder("email")}`,
  );
  redacted = redacted.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    placeholder("email"),
  );
  redacted = redacted.replace(
    /\b(?:bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/giu,
    placeholder("token"),
  );
  redacted = redacted.replace(
    /(?:\+?57[\s-]?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/gu,
    placeholder("phone"),
  );
  redacted = redacted.replace(
    /\b(agente|asesor(?:a)?|propietario|owner|contacto)\s*:\s*[^\n,;<]+/giu,
    (_match, label: string) => `${label}: ${placeholder("contact")}`,
  );
  redacted = redacted.replace(
    /\b(tel[eé]fono|celular|whatsapp|phone)\s*:\s*[^\n,;<]+/giu,
    (_match, label: string) => `${label}: ${placeholder("phone")}`,
  );
  redacted = redacted.replace(
    /\b(apartamento|apto\.?|unidad|unit)\s*(?:#|n[oº°.]*)?\s*[A-Z0-9-]+\b/giu,
    (_match, label: string) => `${label} ${placeholder("exact_unit")}`,
  );
  redacted = redacted.replace(
    /\b(cookie|session|token|authorization|secret|password)\s*[:=]\s*[^\s,;]+/giu,
    (_match, label: string) => `${label}=${placeholder("token")}`,
  );
  return redacted;
}

function redactSensitiveValue(value: unknown, category: string): unknown {
  if (Array.isArray(value))
    return value.map((item) => redactSensitiveValue(item, category));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactSensitiveValue(item, categoryForKey(key) ?? category),
      ]),
    );
  }
  return placeholder(category);
}

function redactJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const category = categoryForKey(key);
        return [
          key,
          category === null
            ? redactJson(item)
            : redactSensitiveValue(item, category),
        ];
      }),
    );
  }
  return typeof value === "string" ? redactFreeText(value) : value;
}

function redactHtml(value: string): string {
  let redacted = value.replace(
    /<!--[\s\S]*?-->/gu,
    "<!-- [REDACTED:comment] -->",
  );
  redacted = redacted.replace(
    /<script\b([^>]*)>[\s\S]*?<\/script\s*>/giu,
    `<script$1>${placeholder("script")}</script>`,
  );
  redacted = redacted.replace(
    /<style\b([^>]*)>[\s\S]*?<\/style\s*>/giu,
    `<style$1>${placeholder("style")}</style>`,
  );
  redacted = redacted.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])(?!data:)(.*?)\2/giu,
    (_match, prefix: string, quote: string) =>
      `${prefix}${quote}${placeholder("image")}${quote}`,
  );
  redacted = redacted.replace(
    /(\b(?:data-)?(?:agent|broker|owner|contact|phone|email|token|cookie|session|unit|apartment|exact-address)[a-z0-9_-]*\s*=\s*)(["'])(.*?)\2/giu,
    (_match, prefix: string, quote: string) =>
      `${prefix}${quote}${placeholder(categoryForKey(prefix) ?? "contact")}${quote}`,
  );
  redacted = redacted.replace(
    /(<([a-z][a-z0-9:-]*)\b[^>]*(?:class|id)=["'][^"']*(?:agent|broker|owner|contact|phone|email|unit|exact-address)[^"']*["'][^>]*>)([^<]*)(<\/\2\s*>)/giu,
    (_match, open: string, _tag: string, _content: string, close: string) =>
      `${open}${placeholder("contact")}${close}`,
  );
  return redactFreeText(redacted);
}

function redactPayload(
  contentType: z.infer<typeof supportedContentTypeSchema>,
  value: string,
): string | null {
  if (contentType === "application/json") {
    try {
      return JSON.stringify(redactJson(JSON.parse(value)));
    } catch {
      return null;
    }
  }
  return contentType === "text/html"
    ? redactHtml(value)
    : redactFreeText(value);
}

const prohibitedPatterns: ReadonlyArray<[string, RegExp]> = [
  ["embedded_binary", /(?:data:image\/|<img\b[^>]*\bsrc=["']data:)/iu],
  ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu],
  ["phone", /(?:\+?57[\s-]?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/u],
  ["token", /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u],
  [
    "tracking_parameter",
    /[?&](?:utm_[^=&#]*|gclid|fbclid|token|session|auth)=[^&#\s"']*/iu,
  ],
  [
    "exact_unit",
    /\b(?:apartamento|apto\.?|unidad|unit)\s*(?:#|n[oº°.]*)?\s*(?!\[REDACTED:)[A-Z0-9-]+\b/iu,
  ],
];

export function scanProhibitedFixtureData(payload: string): string[] {
  const issues = prohibitedPatterns
    .filter(([, pattern]) => pattern.test(payload))
    .map(([code]) => code);
  if (
    [...payload].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 && code !== 9 && code !== 10 && code !== 13;
    })
  )
    issues.push("embedded_control");
  try {
    const parsed: unknown = JSON.parse(payload);
    const containsSensitiveValue = (
      value: unknown,
      inheritedCategory: string | null = null,
    ): boolean => {
      if (Array.isArray(value))
        return value.some((item) =>
          containsSensitiveValue(item, inheritedCategory),
        );
      if (value !== null && typeof value === "object")
        return Object.entries(value).some(([key, item]) =>
          containsSensitiveValue(
            item,
            categoryForKey(key) ?? inheritedCategory,
          ),
        );
      return (
        inheritedCategory !== null && value !== placeholder(inheritedCategory)
      );
    };
    if (containsSensitiveValue(parsed)) issues.push("sensitive_field");
  } catch {
    // HTML and text payloads are covered by the deterministic pattern scanner.
  }
  return [...new Set(issues)].sort();
}

function envelopeSha256(
  envelope: Omit<FixtureEnvelope, "envelope_sha256">,
): string {
  return sha256(canonicalJson(envelope));
}

function artifactFingerprint(
  command: CaptureCommand,
  originalSha256: string,
): string {
  return sha256(
    canonicalJson({
      ...command,
      payload: originalSha256,
      permitted_use: canonicalSet(command.permitted_use),
      parser_compatibility: canonicalSet(command.parser_compatibility),
    }),
  );
}

function originIdentity(origin: FixtureEnvelope["origin"]): string {
  return origin.kind === "permitted_source"
    ? canonicalJson({
        kind: origin.kind,
        source_key: origin.source_key,
        source_url: origin.source_url,
      })
    : canonicalJson({ kind: origin.kind, scenario: origin.scenario });
}

export function validateFixtureArtifact(
  artifact: FixtureArtifact,
): { ok: true } | { ok: false; error: FixtureCaptureError } {
  const parsed = fixtureEnvelopeSchema.safeParse(artifact.envelope);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "invalid_input", issues: inputIssues(parsed.error) },
    };
  if (decodeUtf8(artifact.payload) === null)
    return { ok: false, error: { code: "invalid_encoding" } };
  if (parsed.data.content_type === "application/json") {
    try {
      JSON.parse(artifact.payload);
    } catch {
      return {
        ok: false,
        error: {
          code: "invalid_input",
          issues: [{ code: "invalid_payload", path: ["payload"] }],
        },
      };
    }
  }
  const issues = scanProhibitedFixtureData(artifact.payload);
  if (issues.length > 0)
    return { ok: false, error: { code: "prohibited_data", issues } };
  const { envelope_sha256: recordedEnvelopeSha256, ...envelopePreimage } =
    parsed.data;
  if (
    recordedEnvelopeSha256 !== envelopeSha256(envelopePreimage) ||
    parsed.data.redaction_version !== redactionPolicy.version ||
    parsed.data.redaction_sha256 !== fixtureRedactionPolicySha256 ||
    parsed.data.payload_sha256 !== sha256(artifact.payload) ||
    parsed.data.byte_length !== Buffer.byteLength(artifact.payload, "utf8")
  )
    return { ok: false, error: { code: "integrity_mismatch" } };
  return { ok: true };
}

/** Fixture-only append store. Original source bytes are hashed, redacted, then discarded. */
export class MemoryFixtureCapture {
  readonly #fixtures = new Map<
    string,
    { fingerprint: string; artifact: FixtureArtifact }
  >();
  readonly #successors = new Map<string, string>();

  captureRedactedFixture(input: unknown): FixtureCaptureResult {
    const parsed = captureCommandSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: { code: "invalid_input", issues: inputIssues(parsed.error) },
      };
    const command = parsed.data;
    const decoded = decodeUtf8(command.payload);
    if (decoded === null)
      return { ok: false, error: { code: "invalid_encoding" } };
    const unsafeOriginal = scanProhibitedFixtureData(decoded).filter(
      (issue) => issue === "embedded_binary" || issue === "embedded_control",
    );
    if (unsafeOriginal.length > 0)
      return {
        ok: false,
        error: { code: "prohibited_data", issues: unsafeOriginal },
      };

    const originalSha256 = sha256(new TextEncoder().encode(decoded));
    const fingerprint = artifactFingerprint(command, originalSha256);
    const existing = this.#fixtures.get(command.fixture_id);
    if (existing)
      return existing.fingerprint === fingerprint
        ? {
            ok: true,
            artifact: structuredClone(existing.artifact),
            appended: false,
          }
        : { ok: false, error: { code: "identifier_conflict" } };

    let origin: FixtureEnvelope["origin"];
    if (command.origin.kind === "permitted_source") {
      const sourceUrl = sanitizeUrl(command.origin.source_url);
      if (sourceUrl === null)
        return {
          ok: false,
          error: {
            code: "invalid_input",
            issues: [{ code: "invalid_origin", path: ["origin"] }],
          },
        };
      origin = {
        ...command.origin,
        source_url: sourceUrl,
        original_entity_sha256: originalSha256,
      };
    } else origin = command.origin;
    if (
      (origin.kind === "permitted_source" &&
        origin.collected_at > command.created_at) ||
      (origin.kind === "synthetic" && origin.generated_at > command.created_at)
    )
      return {
        ok: false,
        error: {
          code: "invalid_input",
          issues: [{ code: "invalid_origin", path: ["origin"] }],
        },
      };

    if (command.supersedes_fixture_id !== null) {
      const predecessor = this.#fixtures.get(command.supersedes_fixture_id);
      if (
        command.supersedes_fixture_id === command.fixture_id ||
        !predecessor ||
        this.#successors.has(command.supersedes_fixture_id) ||
        predecessor.artifact.envelope.created_at >= command.created_at ||
        predecessor.artifact.envelope.research_session_id !==
          command.research_session_id ||
        originIdentity(predecessor.artifact.envelope.origin) !==
          originIdentity(origin as FixtureEnvelope["origin"])
      )
        return { ok: false, error: { code: "invalid_supersession" } };
    }

    const redacted = redactPayload(command.content_type, decoded);
    if (redacted === null)
      return {
        ok: false,
        error: {
          code: "invalid_input",
          issues: [{ code: "invalid_payload", path: ["payload"] }],
        },
      };
    const prohibited = scanProhibitedFixtureData(redacted);
    if (prohibited.length > 0)
      return {
        ok: false,
        error: { code: "prohibited_data", issues: prohibited },
      };

    const envelopePreimage = {
      contract_version: "v1",
      fixture_id: command.fixture_id,
      origin,
      created_at: command.created_at,
      representation: "redacted_fixture",
      payload_sha256: sha256(redacted),
      content_type: command.content_type,
      encoding: "utf-8",
      byte_length: Buffer.byteLength(redacted, "utf8"),
      redaction_version: redactionPolicy.version,
      redaction_sha256: fixtureRedactionPolicySha256,
      permitted_use: canonicalSet(command.permitted_use),
      retention_policy_key: command.retention_policy_key,
      research_session_id: command.research_session_id,
      parser_compatibility: canonicalSet(command.parser_compatibility),
      expected_classification: command.expected_classification,
      supersedes_fixture_id: command.supersedes_fixture_id,
    } as const;
    const envelopeResult = fixtureEnvelopeSchema.safeParse({
      ...envelopePreimage,
      envelope_sha256: envelopeSha256(envelopePreimage),
    });
    if (!envelopeResult.success)
      return {
        ok: false,
        error: {
          code: "invalid_input",
          issues: inputIssues(envelopeResult.error),
        },
      };
    const artifact: FixtureArtifact = {
      envelope: envelopeResult.data,
      payload: redacted,
    };
    this.#fixtures.set(command.fixture_id, { fingerprint, artifact });
    if (command.supersedes_fixture_id !== null)
      this.#successors.set(command.supersedes_fixture_id, command.fixture_id);
    return { ok: true, artifact: structuredClone(artifact), appended: true };
  }

  getFixture(fixtureId: string): FixtureArtifact | null {
    const fixture = this.#fixtures.get(fixtureId)?.artifact;
    return fixture ? structuredClone(fixture) : null;
  }
}
