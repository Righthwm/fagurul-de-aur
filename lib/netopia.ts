import crypto from "node:crypto";

/**
 * Netopia Payments v2 (hosted-card) client. The start-payment request/response
 * shape is verified against the official OpenAPI spec and a live sandbox call
 * (returns payment.paymentURL + payment.ntpID). Credentials come from the
 * environment; sandbox is the default (NETOPIA_LIVE=true switches to production).
 *
 * The IPN signature scheme (verifyToken below) is implemented per the v2 docs but
 * is the one part exercised end-to-end only during Netopia's go-live validation.
 */
// Official v2 hosts (doc.netopia-payments.com → Payment API v2.x → Start):
//   sandbox: https://secure.sandbox.netopia-payments.com/payment/card/start
//   live:    https://secure.mobilpay.ro/pay/payment/card/start
const SANDBOX_URL = process.env.NETOPIA_SANDBOX_URL ?? "https://secure.sandbox.netopia-payments.com";
const LIVE_URL = process.env.NETOPIA_LIVE_URL ?? "https://secure.mobilpay.ro/pay";
const IS_LIVE = process.env.NETOPIA_LIVE === "true";
const BASE_URL = IS_LIVE ? LIVE_URL : SANDBOX_URL;

const API_KEY = process.env.NETOPIA_API_KEY ?? "";
const POS_SIGNATURE = process.env.NETOPIA_POS_SIGNATURE ?? "";
const RAW_PUBLIC_KEY = process.env.NETOPIA_PUBLIC_KEY ?? "";
const HAS_PUBLIC_KEY = RAW_PUBLIC_KEY.trim().length > 0;
// Netopia's public key (PEM), used to verify the IPN signature. Normalized so it
// survives common env-paste mistakes (missing BEGIN/END markers, \n-escaping).
const PUBLIC_KEY = normalizePublicKey(RAW_PUBLIC_KEY);

export class NetopiaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetopiaError";
  }
}

/** Card payments can only run once an API key + POS signature are configured. */
export function isNetopiaConfigured(): boolean {
  return API_KEY.length > 0 && POS_SIGNATURE.length > 0;
}

export interface StartPaymentInput {
  orderId: string;
  /** Amount in RON (decimal, e.g. 49.5). */
  amount: number;
  currency?: string;
  description: string;
  billing: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    city: string;
    postalCode: string;
    details: string;
  };
  /** Server-to-server IPN URL. */
  notifyUrl: string;
  /** Browser return URL. */
  redirectUrl: string;
}

export interface StartPaymentResult {
  /** Where to send the customer's browser (hosted card page / 3D Secure). */
  redirectUrl: string;
  /** Netopia transaction id. */
  ntpID: string;
}

export async function startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
  if (!isNetopiaConfigured()) {
    throw new NetopiaError("Netopia is not configured");
  }

  // v2 "card/start" schema — confirmed against a live sandbox call.
  const body = {
    config: { notifyUrl: input.notifyUrl, redirectUrl: input.redirectUrl, language: "ro" },
    payment: { options: { installments: 0, bonus: 0 }, instrument: { type: "card" } },
    order: {
      ntpID: "",
      posSignature: POS_SIGNATURE,
      dateTime: new Date().toISOString(),
      description: input.description,
      orderID: input.orderId,
      amount: input.amount,
      currency: input.currency ?? "RON",
      billing: {
        email: input.billing.email,
        phone: input.billing.phone,
        firstName: input.billing.firstName,
        lastName: input.billing.lastName,
        city: input.billing.city,
        country: 642,
        countryName: "Romania",
        state: input.billing.city,
        postalCode: input.billing.postalCode,
        details: input.billing.details,
      },
    },
  };

  const res = await fetch(`${BASE_URL}/payment/card/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new NetopiaError(`Netopia start failed (HTTP ${res.status})`);
  }

  // Confirmed v2 response: { payment: { paymentURL, ntpID, status } }.
  const json = (await res.json()) as {
    payment?: { ntpID?: string; paymentURL?: string };
  };
  const redirectUrl = json.payment?.paymentURL;
  const ntpID = json.payment?.ntpID ?? "";
  if (!redirectUrl) {
    throw new NetopiaError("Netopia start: no redirect URL in response");
  }
  return { redirectUrl, ntpID };
}

export type PaymentOutcome = "paid" | "failed" | "pending";

export interface IpnResult {
  orderId: string;
  ntpID: string;
  status: PaymentOutcome;
  /** True when the IPN signature checks out against Netopia's public key. */
  verified: boolean;
  /** Non-sensitive reason string for the verification outcome (safe to log). */
  verifyDebug: string;
}

/** RSA JWT algorithms Netopia may use, mapped to Node's hash name. */
const JWT_ALG: Record<string, string> = {
  RS256: "RSA-SHA256",
  RS384: "RSA-SHA384",
  RS512: "RSA-SHA512",
};

/**
 * Normalize a public key read from an env var into a valid SPKI PEM, canonically
 * re-wrapped every time. Env pastes mangle keys in several ways: `\n`-escaped
 * single-line values, stripped `-----BEGIN/END-----` markers, or — the one that
 * bit us in production — markers present but the base64 body flattened onto one
 * line (newlines turned into spaces), which OpenSSL rejects with
 * ERR_OSSL_UNSUPPORTED. We always strip the armor + all whitespace down to the
 * pure base64 body and rebuild 64-char lines, so any of those inputs parse.
 * Returns "" for an empty input.
 */
export function normalizePublicKey(raw: string): string {
  const cleaned = (raw ?? "").replace(/\\n/g, "\n").trim();
  if (!cleaned) return "";
  const body = cleaned
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  if (!body) return "";
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

export interface VerifyOutcome {
  verified: boolean;
  /** Non-sensitive explanation of the outcome, for server logs. */
  debug: string;
}

/**
 * Verify a Netopia IPN signature against a public-key PEM. Netopia sends a
 * `Verification-token` that is either a JWT (header.payload.signature) or a
 * detached base64 signature over the raw body. We read the JWT's `alg` and try
 * the matching RSA hash first, then the other RSA hashes — so an RS256 vs RS512
 * mismatch can't reject a genuinely-signed token. Only RSA verification against
 * OUR trusted public key is ever attempted, so accepting several hashes does not
 * weaken security (a forger would still need the private key).
 */
export function verifySignature(
  token: string | null,
  payload: string,
  publicKeyPem: string
): VerifyOutcome {
  if (!publicKeyPem) return { verified: false, debug: "no public key configured" };
  if (!token) return { verified: false, debug: "no Verification-token present" };

  const parts = token.split(".");
  try {
    if (parts.length === 3) {
      let headerAlg = "RS512";
      try {
        headerAlg = JSON.parse(Buffer.from(parts[0], "base64url").toString()).alg ?? "RS512";
      } catch {
        // keep the RS512 default if the header is unreadable
      }
      const primary = JWT_ALG[headerAlg];
      const algs = primary
        ? [primary, ...Object.values(JWT_ALG).filter((a) => a !== primary)]
        : Object.values(JWT_ALG);
      const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
      const sig = Buffer.from(parts[2], "base64url");
      for (const alg of algs) {
        if (crypto.verify(alg, signed, publicKeyPem, sig)) {
          return { verified: true, debug: `JWT verified (${alg}, header alg=${headerAlg})` };
        }
      }
      return { verified: false, debug: `JWT signature mismatch (header alg=${headerAlg})` };
    }
    // Fallback: token is a detached base64 signature over the raw body.
    for (const alg of ["RSA-SHA512", "RSA-SHA256"]) {
      if (crypto.verify(alg, Buffer.from(payload), publicKeyPem, Buffer.from(token, "base64"))) {
        return { verified: true, debug: `detached signature verified (${alg})` };
      }
    }
    return { verified: false, debug: "detached signature mismatch" };
  } catch (error) {
    const code = (error as { code?: string }).code ?? (error as Error).message;
    return { verified: false, debug: `verification threw: ${code}` };
  }
}

/**
 * Map Netopia v2 numeric status codes to our payment outcome.
 * Per the official OpenAPI spec: 3 = Paid, 5 = Confirmed, 12 = Rejected,
 * 15 = 3-D Secure authentication required (still in progress → pending).
 */
function normalizeStatus(raw: unknown): PaymentOutcome {
  const n = Number(raw);
  if (n === 3 || n === 5) return "paid";
  if (n === 12) return "failed";
  return "pending"; // 15 (3DS in progress) and any other transient state
}

/** Parse + verify an IPN (server-to-server confirmation) from Netopia. */
export function verifyIpn(rawBody: string, verificationToken: string | null): IpnResult {
  const data = JSON.parse(rawBody) as {
    order?: { orderID?: string };
    orderID?: string;
    payment?: { ntpID?: string; status?: unknown };
  };
  const orderId = data.order?.orderID ?? data.orderID ?? "";
  const ntpID = data.payment?.ntpID ?? "";
  const outcome = verifySignature(verificationToken, rawBody, PUBLIC_KEY);
  return {
    orderId,
    ntpID,
    status: normalizeStatus(data.payment?.status),
    verified: outcome.verified,
    verifyDebug: HAS_PUBLIC_KEY ? outcome.debug : "NETOPIA_PUBLIC_KEY is empty",
  };
}
