import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MemoryFixtureCapture,
  scanProhibitedFixtureData,
  validateFixtureArtifact,
} from "./fixture-capture.js";

const at = "2026-09-12T12:00:00.000Z";
const later = "2026-09-12T13:00:00.000Z";
const assessmentHash = "a".repeat(64);

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function command(overrides: Record<string, unknown> = {}) {
  return {
    fixture_id: "fixture-source-1",
    supersedes_fixture_id: null,
    origin: {
      kind: "permitted_source",
      source_key: "example-source",
      source_url:
        "https://example.com/listing/123?utm_source=probe&token=secret#contact",
      collected_at: at,
      assessment_sha256: assessmentHash,
    },
    created_at: at,
    content_type: "application/json",
    payload: JSON.stringify({
      listing: {
        id: "123",
        url: "https://example.com/listing/123?utm_campaign=test#gallery",
        operation: "rent",
        price: "1800000",
        currency: "COP",
        frequency: "monthly",
        administrationFee: "250000",
        builtArea: "72",
        city: "Barranquilla",
        neighborhood: "El Prado",
        publishedAt: "2026-09-01",
        exactAddress: "Carrera 53 # 80-67 Apto 401",
      },
      contact: {
        name: "Ana Pérez",
        phone: "+57 300 123 4567",
        email: "ana@example.com",
        agentId: "agent-998",
      },
      auth: { token: "secret-token", cookie: "session=secret" },
    }),
    permitted_use: ["parser_replay", "evidence_audit"],
    retention_policy_key: "canary-redacted-fixture",
    research_session_id: "research-session-1",
    parser_compatibility: ["parser-v1"],
    expected_classification: "normalized",
    ...overrides,
  };
}

describe("fixture capture", () => {
  it("redacts prohibited JSON fields while retaining parser paths and listing semantics", () => {
    const repository = new MemoryFixtureCapture();
    const result = repository.captureRedactedFixture(command());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payload = JSON.parse(result.artifact.payload) as Record<
      string,
      Record<string, unknown>
    >;
    expect(payload.listing).toMatchObject({
      id: "123",
      url: "https://example.com/listing/123",
      operation: "rent",
      price: "1800000",
      currency: "COP",
      frequency: "monthly",
      administrationFee: "250000",
      builtArea: "72",
      city: "Barranquilla",
      neighborhood: "El Prado",
      publishedAt: "2026-09-01",
      exactAddress: "[REDACTED:exact_address]",
    });
    expect(payload.contact).toEqual({
      name: "[REDACTED:contact]",
      phone: "[REDACTED:phone]",
      email: "[REDACTED:email]",
      agentId: "[REDACTED:agent_id]",
    });
    expect(payload.auth).toEqual({
      token: "[REDACTED:token]",
      cookie: "[REDACTED:cookie]",
    });
    expect(result.artifact.envelope.origin).toMatchObject({
      kind: "permitted_source",
      source_url: "https://example.com/listing/123",
      original_entity_sha256: sha256(command().payload as string),
    });
    expect(scanProhibitedFixtureData(result.artifact.payload)).toEqual([]);
    expect(result.artifact.envelope.payload_sha256).toBe(
      sha256(result.artifact.payload),
    );
    expect(result.artifact.envelope.byte_length).toBe(
      Buffer.byteLength(result.artifact.payload, "utf8"),
    );
    expect(result.artifact.envelope.research_session_id).toBe(
      "research-session-1",
    );
    expect(result.artifact.envelope).not.toHaveProperty(
      "methodology_proposal_id",
    );
  });

  it("is deterministic and treats an exact fixture retry as idempotent", () => {
    const repository = new MemoryFixtureCapture();
    const first = repository.captureRedactedFixture(command());
    const retry = repository.captureRedactedFixture(command());

    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(first.appended).toBe(true);
    expect(retry.appended).toBe(false);
    expect(retry.artifact).toEqual(first.artifact);
    expect(first.artifact.envelope.redaction_version).toBe("redaction-v1");
    expect(first.artifact.envelope.redaction_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects reuse of a fixture ID with different source bytes", () => {
    const repository = new MemoryFixtureCapture();
    expect(repository.captureRedactedFixture(command()).ok).toBe(true);
    expect(
      repository.captureRedactedFixture(
        command({ payload: '{"price":"1900000"}' }),
      ),
    ).toEqual({ ok: false, error: { code: "identifier_conflict" } });
  });

  it("creates immutable successor fixtures by pointing the new fixture to its predecessor", () => {
    const repository = new MemoryFixtureCapture();
    const first = repository.captureRedactedFixture(command());
    const successor = repository.captureRedactedFixture(
      command({
        fixture_id: "fixture-source-2",
        supersedes_fixture_id: "fixture-source-1",
        created_at: later,
        payload: '{"listing":{"id":"123","price":"1900000"}}',
      }),
    );

    expect(first.ok).toBe(true);
    expect(successor.ok).toBe(true);
    if (!first.ok || !successor.ok) return;
    expect(first.artifact.envelope.supersedes_fixture_id).toBeNull();
    expect(successor.artifact.envelope.supersedes_fixture_id).toBe(
      "fixture-source-1",
    );
    expect(repository.getFixture("fixture-source-1")).toEqual(first.artifact);
    expect(
      repository.captureRedactedFixture(
        command({
          fixture_id: "fixture-source-3",
          supersedes_fixture_id: "fixture-source-1",
          created_at: later,
        }),
      ),
    ).toEqual({ ok: false, error: { code: "invalid_supersession" } });
  });

  it("detects payload, byte-length, policy, and envelope tampering", () => {
    const result = new MemoryFixtureCapture().captureRedactedFixture(command());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(validateFixtureArtifact(result.artifact)).toEqual({ ok: true });
    expect(
      validateFixtureArtifact({
        ...result.artifact,
        payload: `${result.artifact.payload} `,
      }),
    ).toEqual({ ok: false, error: { code: "integrity_mismatch" } });
    expect(
      validateFixtureArtifact({
        ...result.artifact,
        envelope: {
          ...result.artifact.envelope,
          retention_policy_key: "tampered-policy",
        },
      }),
    ).toEqual({ ok: false, error: { code: "integrity_mismatch" } });
    expect(
      validateFixtureArtifact({
        ...result.artifact,
        envelope: {
          ...result.artifact.envelope,
          redaction_sha256: "b".repeat(64),
        },
      }),
    ).toEqual({ ok: false, error: { code: "integrity_mismatch" } });
  });

  it("redacts HTML values without removing stable parser attributes", () => {
    const result = new MemoryFixtureCapture().captureRedactedFixture(
      command({
        fixture_id: "fixture-html",
        content_type: "text/html",
        payload:
          '<article data-listing-id="123"><span class="price">$ 1.800.000</span><span class="agent-name">Ana Pérez</span><a href="mailto:ana@example.com">Contactar</a><a class="detail" href="https://example.com/listing/123?utm_source=x#contact">Ver</a></article>',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.payload).toContain('data-listing-id="123"');
    expect(result.artifact.payload).toContain('class="price"');
    expect(result.artifact.payload).toContain("$ 1.800.000");
    expect(result.artifact.payload).toContain('class="agent-name"');
    expect(result.artifact.payload).toContain("[REDACTED:contact]");
    expect(result.artifact.payload).toContain(
      'href="https://example.com/listing/123"',
    );
    expect(scanProhibitedFixtureData(result.artifact.payload)).toEqual([]);
  });

  it("redacts contact and exact-unit PII in plain text while preserving rent semantics", () => {
    const result = new MemoryFixtureCapture().captureRedactedFixture(
      command({
        fixture_id: "fixture-text",
        content_type: "text/plain",
        payload:
          "Canon: COP 1.800.000 mensual\nÁrea: 72 m2\nAgente: Ana Pérez\nTeléfono: +57 300 123 4567\nApartamento 401",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.payload).toContain("COP 1.800.000 mensual");
    expect(result.artifact.payload).toContain("Área: 72 m2");
    expect(result.artifact.payload).not.toContain("Ana Pérez");
    expect(result.artifact.payload).not.toContain("300 123 4567");
    expect(result.artifact.payload).not.toContain("401");
    expect(scanProhibitedFixtureData(result.artifact.payload)).toEqual([]);
  });

  it("redacts nested alternate keys, description PII, exact addresses, identity numbers, and image URLs", () => {
    const result = new MemoryFixtureCapture().captureRedactedFixture(
      command({
        fixture_id: "fixture-nested",
        payload: JSON.stringify({
          listing: {
            price: "1800000",
            area: "72",
            description:
              "Escriba a ventas@example.com o al +57-310-555-0199. Apartamento 8B.",
          },
          CONTACT_INFO: [
            {
              CorreoElectronico: "ventas@example.com",
              TelefonoMovil: "+57 310 555 0199",
              Direccion: "Calle 80 # 53-20",
              Cedula: "1234567890",
            },
          ],
          galleryImages: ["https://images.example.com/private/photo.jpg"],
        }),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.payload).toContain('"price":"1800000"');
    expect(result.artifact.payload).toContain('"area":"72"');
    expect(result.artifact.payload).not.toContain("ventas@example.com");
    expect(result.artifact.payload).not.toContain("310 555 0199");
    expect(result.artifact.payload).not.toContain("Calle 80");
    expect(result.artifact.payload).not.toContain("1234567890");
    expect(result.artifact.payload).not.toContain("photo.jpg");
    expect(scanProhibitedFixtureData(result.artifact.payload)).toEqual([]);
  });

  it("detects unredacted sensitive JSON fields even when their values do not match a PII pattern", () => {
    expect(
      scanProhibitedFixtureData(
        JSON.stringify({ ownerName: "Ana", galleryImages: ["private.jpg"] }),
      ),
    ).toEqual(["sensitive_field"]);
  });

  it("removes active HTML content, encoded contacts, image references, and credentialed URLs", () => {
    const result = new MemoryFixtureCapture().captureRedactedFixture(
      command({
        fixture_id: "fixture-hostile-html",
        content_type: "text/html",
        payload:
          '<!-- ana@example.com --><script>const token="secret"</script><style>.x{background:url(https://images.example/x.jpg)}</style><span class="email">ana&#64;example.com</span><img src="https://images.example/x.jpg"><a href="https://user:pass@example.com/listing/123?utm_source=x">Ver</a><div class="price">1800000 COP</div>',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.payload).not.toContain("ana@example.com");
    expect(result.artifact.payload).not.toContain("ana&#64;example.com");
    expect(result.artifact.payload).not.toContain("secret");
    expect(result.artifact.payload).not.toContain("images.example");
    expect(result.artifact.payload).not.toContain("user:pass");
    expect(result.artifact.payload).toContain("1800000 COP");
    expect(scanProhibitedFixtureData(result.artifact.payload)).toEqual([]);
  });

  it("rejects malformed JSON instead of treating it as text", () => {
    expect(
      new MemoryFixtureCapture().captureRedactedFixture(
        command({ fixture_id: "fixture-malformed", payload: '{"price":' }),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid_input", issues: [{ code: "invalid_payload" }] },
    });
  });

  it("rejects unsupported content, malformed UTF-8, embedded binaries, and synthetic source claims", () => {
    const repository = new MemoryFixtureCapture();
    expect(
      repository.captureRedactedFixture(
        command({ content_type: "image/jpeg", payload: "jpeg" }),
      ),
    ).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(
      repository.captureRedactedFixture(
        command({
          fixture_id: "fixture-bad-utf8",
          payload: new Uint8Array([0xc3, 0x28]),
        }),
      ),
    ).toEqual({ ok: false, error: { code: "invalid_encoding" } });
    expect(
      repository.captureRedactedFixture(
        command({
          fixture_id: "fixture-binary",
          content_type: "text/html",
          payload: '<img src="data:image/png;base64,AAAA">',
        }),
      ),
    ).toEqual({
      ok: false,
      error: { code: "prohibited_data", issues: ["embedded_binary"] },
    });
    expect(
      repository.captureRedactedFixture(
        command({
          fixture_id: "fixture-synthetic",
          origin: {
            kind: "synthetic",
            scenario: "missing fee scope",
            generated_at: at,
            source_url: "https://example.com/listing/123",
          },
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(
      repository.captureRedactedFixture(
        command({
          fixture_id: "fixture-circular-reference",
          research_session_id: undefined,
          methodology_proposal_id: "future-proposal",
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });
});
