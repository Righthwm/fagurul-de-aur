/**
 * Client-side conversion tracking. Fires the Purchase event to both the Meta
 * Pixel and Google Analytics 4 exactly once per order, de-duplicated via
 * localStorage so a page refresh (the return page keeps polling; the checkout
 * success screen persists) never double-counts a sale.
 *
 * `window.fbq` / `window.gtag` are declared globally by the MetaPixel and
 * GoogleAnalytics components.
 */
const FIRED_KEY = "fda-purchase-fired";

function firedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markFired(orderId: string): void {
  try {
    const ids = firedIds();
    if (!ids.includes(orderId)) {
      ids.push(orderId);
      // Keep the list bounded — we only need recent orders for dedup.
      window.localStorage.setItem(FIRED_KEY, JSON.stringify(ids.slice(-50)));
    }
  } catch {
    /* localStorage unavailable — worst case a duplicate event */
  }
}

/**
 * Report a completed purchase to Meta Pixel + GA4. Safe to call more than once
 * for the same order; only the first call fires. `value` is the order total in
 * whole RON.
 */
export function trackPurchase(orderId: string, value: number): void {
  if (typeof window === "undefined") return;
  if (firedIds().includes(orderId)) return;
  markFired(orderId);

  // eventID lets Meta de-duplicate against a future server-side (CAPI) event.
  window.fbq?.("track", "Purchase", { value, currency: "RON" }, { eventID: orderId });
  window.gtag?.("event", "purchase", {
    transaction_id: orderId,
    value,
    currency: "RON",
  });
}
