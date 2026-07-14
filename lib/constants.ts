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
 * Per-honey-jar delivery surcharge (lei), on top of the flat locality fee.
 * Jars up to the threshold cost the full rate; each jar beyond it the reduced
 * rate. A honey jar is 1kg, so the threshold of 10 jars equals the 10 kg tier.
 */
export const HONEY_JAR_SHIPPING_SURCHARGE = 5;
export const HONEY_JAR_SHIPPING_SURCHARGE_REDUCED = 3;
export const HONEY_JAR_SURCHARGE_THRESHOLD = 10;

/** Total honey-jar surcharge (lei) for a given number of jars, tiered at the threshold. */
export function honeyJarSurcharge(jars: number): number {
  const full = Math.min(jars, HONEY_JAR_SURCHARGE_THRESHOLD);
  const extra = Math.max(0, jars - HONEY_JAR_SURCHARGE_THRESHOLD);
  return full * HONEY_JAR_SHIPPING_SURCHARGE + extra * HONEY_JAR_SHIPPING_SURCHARGE_REDUCED;
}

/** Discount code offered for newsletter / exit-popup signups. */
export const NEWSLETTER_DISCOUNT_CODE = "FAGURE5";
