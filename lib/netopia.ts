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
// Netopia's public key (PEM) used to verify the IPN signature. Supports \n-escaped env values.
const PUBLIC_KEY = (process.env.NETOPIA_PUBLIC_KEY ?? "").replace(/\\n/g, "\n");

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

/**
 * Verify the IPN signature against Netopia's public key. Netopia sends a
 * `Verification-token`; we support both a JWT (header.payload.signature, RS512)
 * and a detached base64 signature over the raw body. Confirmed at go-live.
 */
function verifyToken(token: string | null, payload: string): boolean {
  if (!PUBLIC_KEY || !token) return false;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const signed = `${parts[0]}.${parts[1]}`;
      return crypto.verify("RSA-SHA512", Buffer.from(signed), PUBLIC_KEY, Buffer.from(parts[2], "base64url"));
    }
    // Fallback: token is a detached base64 signature over the raw body.
    return crypto.verify("RSA-SHA512", Buffer.from(payload), PUBLIC_KEY, Buffer.from(token, "base64"));
  } catch {
    return false;
  }
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
  return {
    orderId,
    ntpID,
    status: normalizeStatus(data.payment?.status),
    verified: verifyToken(verificationToken, rawBody),
  };
}
