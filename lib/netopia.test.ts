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

  it("normalizes a PKCS#1 'RSA PUBLIC KEY' to SPKI", () => {
    const pkcs1 = publicKey.export({ type: "pkcs1", format: "pem" }).toString();
    const rebuilt = normalizePublicKey(pkcs1);
    const token = makeJwt("RS512", { orderID: "SB-1" });
    expect(verifySignature(token, "", rebuilt).verified).toBe(true);
  });
});

describe("normalizePublicKey with an X.509 certificate (the live-key bug)", () => {
  // A self-signed cert + its private key. Netopia's LIVE credential is a
  // certificate, not a bare public key; treating it as SPKI throws
  // ERR_OSSL_ASN1_WRONG_TAG. normalizePublicKey must extract the key from it.
  const CERT_PEM = `-----BEGIN CERTIFICATE-----
MIICmjCCAYICCQDGi8powqd/wTANBgkqhkiG9w0BAQsFADAPMQ0wCwYDVQQDDAR0
ZXN0MB4XDTI2MDcxNTEyNTUwNloXDTM2MDcxMjEyNTUwNlowDzENMAsGA1UEAwwE
dGVzdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMi2ZcJ98GMT4wiG
meHRszKE5pbb8ceTS2SIB+JYYUggydrpyeBy5KzdPOkVDg4mpAqPr8GTRInYZ7DQ
kE50JzxiBMF93az6E/1+r+SZpKtZoweY0eBs8zPmUgNCpwbiCw3yYNfUwsX+03Wl
2felRs833aOPGOsvo5z+CgjnTsjLB4CEDoojskGVKNscrsojK3oj/wXQpIDazG10
10u4fMhtoW5RYAL/TEBfsbtTqPfoBjTvwWvW7qxyMl1oIWPyBUVM4zguCV3q9fWC
//vw+FxEQiz7LTOe0q5j29BxS26A7pEuzvNkY5y2W8VejD+qxnhuJChf0coAPuzB
7qZ22s8CAwEAATANBgkqhkiG9w0BAQsFAAOCAQEABa47bf6xQjmTCRd1zoLM9b+L
MxOpwXxUIGM0qH8vopmawsVpNTv5qp4X4uO1qoJlCg16p/JYVKOgW/qkS2D2aVod
TfBxvG69U/nBQU+Mz5pZsn1bseKZOpENjlGFlgyFIjrr/SEVQBswSU5rF00Veq2x
YxWpAGmQa8Atiqh4c67T6122a2H6Fjc0rWYQK62jDcBZg5ns9zm8H3wB8KWCfqek
8zQ/KqIR9A4ftEZgYs2UityEnl6YJ5hm7qhQt0ebiQE051H9poDXvh6R6+M30PgW
PvCSWyZb5ylekJO2m+AGHRCx74pKIktRVKKzOh0LO+dyWB2DzQf7wHSjlrSvMA==
-----END CERTIFICATE-----`;
  const CERT_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDItmXCffBjE+MI
hpnh0bMyhOaW2/HHk0tkiAfiWGFIIMna6cngcuSs3TzpFQ4OJqQKj6/Bk0SJ2Gew
0JBOdCc8YgTBfd2s+hP9fq/kmaSrWaMHmNHgbPMz5lIDQqcG4gsN8mDX1MLF/tN1
pdn3pUbPN92jjxjrL6Oc/goI507IyweAhA6KI7JBlSjbHK7KIyt6I/8F0KSA2sxt
dNdLuHzIbaFuUWAC/0xAX7G7U6j36AY078Fr1u6scjJdaCFj8gVFTOM4Lgld6vX1
gv/78PhcREIs+y0zntKuY9vQcUtugO6RLs7zZGOctlvFXow/qsZ4biQoX9HKAD7s
we6mdtrPAgMBAAECggEBAJsbiawx0xFeDvdJvaWrfoYt+lzfAAuxInRAQ4eBsTwi
SpvoS+AuKdYE6stdQA1jgyW+QJ6hhjfYitkzdDGMxb1+Khq1gBfq8oPV4WwR6BWb
Icf/K0H6MEANX5exbI5/JPfUNU7V1udXtGaYksc0bHI6xAdf0Gv/1rq9/1c+Gb5E
+K4PMhf6yORRbtxJhEC6s8WxyI9PdKcL9Btkt9KA9mOZk+yx3nxqJYq8pVx5ppyX
4NCNWzokPxIC+ZDc17z4oP9pd4gKlbIIdjGg2faTwTDo3ad5WwR4cxhUjg4yuAZU
Ivdj1ew8DBdY89hWvYOdwoLT7lB1suVGEAn0ACu8t8ECgYEA9ixqImKu1q/Xw+2d
jW97mqEYr+6VA8M26xioP1GEis+pqMhQvyWDgkuidt61vWO9iqFYQshpa8cC4tIU
0fCGtcJvwWTBxtvspgjl9cmLH2e6gZfapUetDyWom202DMz2uF/WDqSKOX1fSuSq
TWpOVz4d26K2G8pa5BebSo8ndP8CgYEA0LltozV+dQtf029Rxt+1oBxqVf1sb6rS
0oY4Rc/r5rUAoUggsxIcHSbcTkGLO4r0LZcuA7NfeS4Hs6Xw/lgco7ZJs8Hh7J2F
PbTqYPLKf2m8Zb969Pj1Npr137fFtjhCiinph/z/JJ2pZp55evZXcJbu/rD4suZ1
Zjxl3U0oijECgYA0ZGeCQfZsAqitLlklzOBFnJugdeqJDncVuf203CiVUnUNUvS8
ecNva6F8IxIS6LNiWcxrCjRFl+lpVMTRmZtR+7vFMSh8pjnLbIFkuiw91tm+0w7Z
tlOCscUcrzWdq9Gmk97+5s30RlaNnfUQ3NsnfjTkldCkQYDuooeOasE/CQKBgEm0
ELj/HMZr28ynlHLrcBE3t3zh3jaYVZWte5V7VEvFQpGxDIrvLCpHHKgtkOLXsF2g
8sivwFjkHigbwrutlX9h0Si+n+6TuQcPKWxOj57qUXKEaQC0ILLFiWkUVaaAu05a
enJgrh/Z5IWuFCuNbVb+lSouh8N0iaQuU7IPmu8hAoGBAMV62vPNR6rpudOZMfVo
RQwNN2GAbH3lHsy8GCtQFfqkcRLnBFqQa7wxJGCEr3Wv34RaWeeL0fFRWfIyszJB
26ZQFi4CLReXqYVrEiCKruR6SSNmVo5H7UXijB6vw44+orKwcbdM5wK5Ztt8ogY0
tRd34pw75JGsOCGYXqPxzpEM
-----END PRIVATE KEY-----`;

  it("extracts the public key from a certificate so verification succeeds", () => {
    const spki = normalizePublicKey(CERT_PEM);
    expect(spki).toContain("-----BEGIN PUBLIC KEY-----");

    // Sign a JWT with the cert's private key; the extracted key must verify it.
    const signed = `${Buffer.from(JSON.stringify({ alg: "RS512", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ orderID: "SB-1" })).toString("base64url")}`;
    const sig = crypto.sign("RSA-SHA512", Buffer.from(signed), CERT_KEY).toString("base64url");
    expect(verifySignature(`${signed}.${sig}`, "", spki).verified).toBe(true);
  });

  it("also repairs a certificate whose body was flattened onto one line", () => {
    const spki = normalizePublicKey(CERT_PEM.replace(/\n/g, " "));
    expect(spki).toContain("-----BEGIN PUBLIC KEY-----");
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
