import crypto from "crypto";

/**
 * Meta Conversions API (server-side) — sends the Purchase event straight from
 * our backend to Meta, in addition to the browser Pixel. Deduplicated against
 * the Pixel via `event_id = orderId`, so a purchase is counted once even when
 * both arrive. Best-effort: no-ops when the token is unset and never throws, so
 * a CAPI hiccup can never break checkout.
 *
 * Configure with the env var META_CAPI_TOKEN (a Conversions API access token).
 * Optionally set META_CAPI_TEST_CODE to route events to Events Manager → Test
 * Events while verifying.
 */
const PIXEL_ID = "1664397665686973"; // same pixel as components/analytics/MetaPixel.tsx
const CAPI_TOKEN = process.env.META_CAPI_TOKEN ?? "";
// TEMPORARY: routes CAPI events to Events Manager → Test Events for verification.
// Revert to `process.env.META_CAPI_TEST_CODE || undefined` once confirmed, or
// real purchases will be treated as test events and won't count as conversions.
const TEST_CODE = process.env.META_CAPI_TEST_CODE || "TEST4054";
const API_VERSION = "v21.0";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Hash a normalized (trimmed, lowercased) value, or undefined when empty. */
function hashNorm(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const n = value.trim().toLowerCase();
  return n ? sha256(n) : undefined;
}

/** Normalize a RO phone to E.164 digits (40XXXXXXXXX) and hash it. */
function hashPhone(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  let d = value.replace(/\D/g, "");
  if (d.startsWith("0")) d = "4" + d; // 07XXXXXXXX -> 407XXXXXXXX
  else if (d.length === 9) d = "40" + d; // 7XXXXXXXX -> 407XXXXXXXX
  return d ? sha256(d) : undefined;
}

export interface CapiPurchase {
  orderId: string;
  value: number;
  currency?: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
  /** Browser signals — only available when the customer's own request triggers
   *  the event (ramburs checkout), not for the Netopia server-to-server IPN. */
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  sourceUrl?: string | null;
}

/** Extract the customer's IP, user-agent and Meta cookies from their request. */
export function requestClientData(request: Request): {
  clientIp: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
} {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  const clientIp = (xff ? xff.split(",")[0].trim() : h.get("x-real-ip")) || null;
  const cookie = h.get("cookie") ?? "";
  const readCookie = (name: string): string | null => {
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  };
  return {
    clientIp,
    userAgent: h.get("user-agent"),
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc"),
  };
}

/**
 * Best-effort server-side Purchase to the Meta Conversions API. Silent no-op
 * when unconfigured or the value is invalid; logs and swallows any error.
 */
export async function sendCapiPurchase(p: CapiPurchase): Promise<void> {
  if (!CAPI_TOKEN) return;
  if (!Number.isFinite(p.value) || p.value <= 0) return;

  const userData: Record<string, unknown> = {};
  const set = (key: string, hashed: string | undefined) => {
    if (hashed) userData[key] = [hashed];
  };
  set("em", hashNorm(p.email));
  set("ph", hashPhone(p.phone));
  set("fn", hashNorm(p.firstName));
  set("ln", hashNorm(p.lastName));
  set("ct", hashNorm(p.city?.replace(/\s+/g, "")));
  set("st", hashNorm(p.county?.replace(/\s+/g, "")));
  set("zp", hashNorm(p.postalCode));
  userData.country = [sha256("ro")];
  if (p.clientIp) userData.client_ip_address = p.clientIp;
  if (p.userAgent) userData.client_user_agent = p.userAgent;
  if (p.fbp) userData.fbp = p.fbp;
  if (p.fbc) userData.fbc = p.fbc;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: p.orderId, // dedup key shared with the browser Pixel
        action_source: "website",
        ...(p.sourceUrl ? { event_source_url: p.sourceUrl } : {}),
        user_data: userData,
        custom_data: {
          value: Math.round(p.value * 100) / 100,
          currency: p.currency ?? "RON",
        },
      },
    ],
  };
  if (TEST_CODE) body.test_event_code = TEST_CODE;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (!res.ok) {
      console.error("Meta CAPI Purchase failed:", res.status, await res.text());
    }
  } catch (error) {
    console.error("Meta CAPI Purchase error:", error);
  }
}
