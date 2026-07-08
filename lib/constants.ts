// Plain constants shared by both client (cart) and server (shipping) code.
// Kept free of "use client" and heavy imports so it's safe to import anywhere.

/** Flat delivery fee (lei) to an urban locality (oraș / municipiu). */
export const SHIPPING_URBAN = 30;

/** Flat delivery fee (lei) to a rural locality (sat / comună). */
export const SHIPPING_RURAL = 50;

/** Delivery fee (lei) for a given locality type. */
export function shippingFee(localityType: "urban" | "rural"): number {
  return localityType === "rural" ? SHIPPING_RURAL : SHIPPING_URBAN;
}

/** Discount code offered for newsletter / exit-popup signups. */
export const NEWSLETTER_DISCOUNT_CODE = "FAGURE5";
