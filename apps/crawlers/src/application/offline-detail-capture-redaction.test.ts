import { describe, expect, it } from "vitest";
import { redactOfflineDetailCapture } from "./offline-detail-capture-redaction.js";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("offline detail capture redaction", () => {
  it("retains only direct, uniquely paired allowlisted claims", () => {
    const original = bytes(`
      <dl>
        <dt>Canon de arrendamiento</dt><dd>COP 1800000 mensual</dd>
        <dt>Área construida</dt><dd>72 m²</dd>
        <dt>Tipo de inmueble</dt><dd>Apartamento</dd>
        <dt>Operación</dt><dd>Arriendo</dd>
        <dt>Ciudad</dt><dd>Barranquilla</dd>
        <dt>Barrio</dt><dd>El Prado</dd>
      </dl>
    `);

    const result = redactOfflineDetailCapture({ original_bytes: original });

    expect(result).toEqual({
      ok: true,
      receipt: {
        byte_length: expect.any(Number),
        original_bytes_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      claims: {
        source_listing_id: null,
        listing_url: null,
        listing_role: "for_rent",
        asking_amount: "1800000",
        currency: "COP",
        frequency: "monthly",
        fee_scope: null,
        built_area_sqm: "72",
        property_type: "apartment",
        rental_basis: null,
        listing_status: null,
        city: "Barranquilla",
        area: "El Prado",
      },
    });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("fails closed to absent claims when a permitted label has more than one paired value", () => {
    const original = bytes(`
      <dl>
        <dt>Área construida</dt><dd>72 m²</dd>
        <dt>Área construida</dt><dd>80 m²</dd>
      </dl>
    `);

    const result = redactOfflineDetailCapture({ original_bytes: original });

    expect(result).toMatchObject({
      ok: true,
      claims: { built_area_sqm: null },
    });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("does not retain arbitrary text, labels, scripts, or JSON-LD", () => {
    const secret = "Carrera 53 # 80-67, Ana Perez, 3001234567";
    const original = bytes(`
      <script type="application/ld+json">{"address":"${secret}","price":"999"}</script>
      <p>Contacto: ${secret}</p>
      <dl><dt>Direccion exacta</dt><dd>${secret}</dd></dl>
    `);

    const result = redactOfflineDetailCapture({ original_bytes: original });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      ok: true,
      claims: {
        asking_amount: null,
        city: null,
        area: null,
      },
    });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("Direccion exacta");
    expect(serialized).not.toContain("application/ld+json");
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("rejects malformed UTF-8 without retaining the body", () => {
    const original = new Uint8Array([0xc3, 0x28]);

    expect(redactOfflineDetailCapture({ original_bytes: original })).toEqual({
      ok: false,
      error: { code: "invalid_utf8" },
    });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });
});
