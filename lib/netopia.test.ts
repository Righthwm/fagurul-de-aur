import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { normalizePublicKey, verifySignature } from "@/lib/netopia";

/**
 * The Netopia IPN carries a `Verification-token` JWT signed with the merchant's
 * RSA key. Netopia's dashboard reported our /api/payment/confirm returning 400
 * "invalid signature" even with the correct public key configured — the verifier
 * hardcoded RSA-SHA512 and rejected any other JWT `alg`, and it broke if the PEM
 * markers were stripped. These tests pin the resilient behavior.
 */

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const PUB_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();

const b64u = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Build a signed JWT the way Netopia does: sign `header.payload` with the alg. */
function makeJwt(alg: "RS256" | "RS384" | "RS512", payload: object): string {
  const nodeAlg = { RS256: "RSA-SHA256", RS384: "RSA-SHA384", RS512: "RSA-SHA512" }[alg];
  const signed = `${b64u({ alg, typ: "JWT" })}.${b64u(payload)}`;
  const sig = crypto.sign(nodeAlg, Buffer.from(signed), privateKey).toString("base64url");
  return `${signed}.${sig}`;
}

describe("normalizePublicKey", () => {
  it("keeps a well-formed PEM intact", () => {
    expect(normalizePublicKey(PUB_PEM)).toContain("-----BEGIN PUBLIC KEY-----");
  });

  it("reconstructs a PEM when BEGIN/END markers were stripped", () => {
    const stripped = PUB_PEM
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s+/g, "");
    const rebuilt = normalizePublicKey(stripped);
    expect(rebuilt).toContain("-----BEGIN PUBLIC KEY-----");
    expect(rebuilt).toContain("-----END PUBLIC KEY-----");
    // And the rebuilt PEM must actually work for verification.
    const token = makeJwt("RS512", { orderID: "SB-1" });
    expect(verifySignature(token, "", rebuilt).verified).toBe(true);
  });

  it("converts \\n-escaped single-line env values into real newlines", () => {
    const escaped = PUB_PEM.replace(/\n/g, "\\n");
    expect(normalizePublicKey(escaped)).toBe(PUB_PEM.trim());
  });

  it("repairs a key whose base64 body was flattened with spaces (the prod bug)", () => {
    // Markers present, but newlines became spaces → OpenSSL ERR_OSSL_UNSUPPORTED.
    const flattened = PUB_PEM.replace(/\n/g, " ").trim();
    const rebuilt = normalizePublicKey(flattened);
    const token = makeJwt("RS512", { orderID: "SB-1" });
    expect(verifySignature(token, "", rebuilt).verified).toBe(true);
  });
});

describe("verifySignature", () => {
  it("verifies an RS512-signed JWT (Netopia's documented alg)", () => {
    const token = makeJwt("RS512", { orderID: "SB-1" });
    expect(verifySignature(token, "", PUB_PEM).verified).toBe(true);
  });

  it("verifies an RS256-signed JWT (the alg mismatch that caused the 400)", () => {
    const token = makeJwt("RS256", { orderID: "SB-1" });
    const out = verifySignature(token, "", PUB_PEM);
    expect(out.verified).toBe(true);
  });

  it("rejects a JWT signed by a different key", () => {
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const signed = `${b64u({ alg: "RS512", typ: "JWT" })}.${b64u({ orderID: "SB-1" })}`;
    const sig = crypto.sign("RSA-SHA512", Buffer.from(signed), other.privateKey).toString("base64url");
    expect(verifySignature(`${signed}.${sig}`, "", PUB_PEM).verified).toBe(false);
  });

  it("reports a reason when no key is configured", () => {
    const token = makeJwt("RS512", { orderID: "SB-1" });
    const out = verifySignature(token, "", "");
    expect(out.verified).toBe(false);
    expect(out.debug).toMatch(/no public key/i);
  });

  it("reports a reason when no token is present", () => {
    const out = verifySignature(null, "", PUB_PEM);
    expect(out.verified).toBe(false);
    expect(out.debug).toMatch(/no.*token/i);
  });

  it("verifies a detached base64 signature over the raw body (fallback)", () => {
    const body = '{"payment":{"status":3}}';
    const sig = crypto.sign("RSA-SHA512", Buffer.from(body), privateKey).toString("base64");
    expect(verifySignature(sig, body, PUB_PEM).verified).toBe(true);
  });
});
