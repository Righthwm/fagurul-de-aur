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
 * RON. A non-positive or non-finite value is never sent: Meta counts a Purchase
 * with a missing/zero price as an invalid conversion, which drags down the
 * "valid value + currency" quality score in Events Manager.
 */
export function trackPurchase(orderId: string, value: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(value) || value <= 0) return;
  if (firedIds().includes(orderId)) return;
  markFired(orderId);

  // Round to 2 decimals so the value is always a clean numeric amount, and pass
  // it as a Number (not a string) — Meta validates both the type and the format.
  const amount = Math.round(value * 100) / 100;

  // eventID lets Meta de-duplicate against a future server-side (CAPI) event.
  window.fbq?.("track", "Purchase", { value: amount, currency: "RON" }, { eventID: orderId });
  window.gtag?.("event", "purchase", {
    transaction_id: orderId,
    value: amount,
    currency: "RON",
  });
}

export type AnalyticsItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

/** Product page view. Meta ViewContent + GA4 view_item. */
export function trackViewContent(item: { id: string; name: string; price: number }): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "ViewContent", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value: item.price,
    currency: "RON",
  });
  window.gtag?.("event", "view_item", {
    currency: "RON",
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, price: item.price }],
  });
}

/** A paid line added to the cart. Meta AddToCart + GA4 add_to_cart. */
export function trackAddToCart(item: AnalyticsItem): void {
  if (typeof window === "undefined") return;
  const value = item.price * item.quantity;
  window.fbq?.("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    contents: [{ id: item.id, quantity: item.quantity }],
    value,
    currency: "RON",
  });
  window.gtag?.("event", "add_to_cart", {
    currency: "RON",
    value,
    items: [{ item_id: item.id, item_name: item.name, price: item.price, quantity: item.quantity }],
  });
}

/** Entering the checkout. Meta InitiateCheckout + GA4 begin_checkout. */
export function trackInitiateCheckout(items: AnalyticsItem[]): void {
  if (typeof window === "undefined") return;
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const numItems = items.reduce((sum, i) => sum + i.quantity, 0);
  window.fbq?.("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    content_type: "product",
    contents: items.map((i) => ({ id: i.id, quantity: i.quantity })),
    num_items: numItems,
    value,
    currency: "RON",
  });
  window.gtag?.("event", "begin_checkout", {
    currency: "RON",
    value,
    items: items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
  });
}
