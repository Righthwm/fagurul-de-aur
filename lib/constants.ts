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

/**
 * Flat per-honey-jar delivery surcharge (lei), on top of the flat locality fee.
 * A honey jar is 1kg; the same rate applies to every jar, at any count.
 */
export const HONEY_JAR_SHIPPING_SURCHARGE = 2;

/** Total honey-jar surcharge (lei): a flat rate per jar, regardless of count. */
export function honeyJarSurcharge(jars: number): number {
  return jars * HONEY_JAR_SHIPPING_SURCHARGE;
}

/** Discount code offered for newsletter / exit-popup signups. */
export const NEWSLETTER_DISCOUNT_CODE = "FAGURE5";
