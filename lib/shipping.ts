import { products } from "@/lib/products";
import { shippingFee, honeyJarSurcharge } from "@/lib/constants";

/** Fallback weight (kg) for a cart line whose variant has no configured weight. */
const DEFAULT_ITEM_WEIGHT_KG = 1;

export interface CartLineInput {
  productId: string;
  variantPrice: number;
  quantity: number;
}

/** Total gross parcel weight (kg) for the cart, looked up from product data. */
export function packageWeightKg(items: CartLineInput[]): number {
  let total = 0;
  for (const line of items) {
    const product = products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.price === line.variantPrice);
    const weight = variant?.weightKg ?? product?.variants[0]?.weightKg ?? DEFAULT_ITEM_WEIGHT_KG;
    total += weight * line.quantity;
  }
  return Math.round(total * 100) / 100;
}

/** Cart subtotal (lei), recomputed from product data rather than trusting the client. */
export function cartSubtotal(items: CartLineInput[]): number {
  return items.reduce((sum, line) => sum + line.variantPrice * line.quantity, 0);
}

/**
 * Number of honey jars in the cart (propolis and any non-honey product excluded).
 * A multi-jar variant such as "Pachet 5 borcane" counts as its jar count (5).
 * Bonus jars (price 0) fall back to the base 1kg jar and count as one each.
 */
export function honeyJarCount(items: CartLineInput[]): number {
  let jars = 0;
  for (const line of items) {
    const product = products.find((p) => p.id === line.productId);
    if (!product || product.category !== "miere") continue;
    const variant =
      product.variants.find((v) => v.price === line.variantPrice) ?? product.variants[0];
    const label = variant?.weight ?? variant?.type ?? "";
    const pack = label.match(/(\d+)\s*borcane/i);
    jars += (pack ? parseInt(pack[1], 10) : 1) * line.quantity;
  }
  return jars;
}

export interface ShippingResult {
  /** Delivery fee (lei): flat locality fee (30 urban / 50 rural) + flat per-jar surcharge. */
  cost: number;
  /** Gross parcel weight (kg), informative only — the fee no longer depends on it. */
  weightKg: number;
}

export interface EstimateInput {
  items: CartLineInput[];
  county: string;
  locality: string;
  localityType: "urban" | "rural";
  /** Cash-on-delivery amount in lei (ramburs); 0 when paying by card. */
  cashOnDelivery: number;
}

/**
 * Authoritative shipping calculation, shared by the estimate endpoint and the
 * checkout route. A flat two-tier locality fee (30 lei city / 50 lei village)
 * plus a flat per-honey-jar surcharge: 2 lei per jar, at any count.
 */
export async function estimateShipping(input: EstimateInput): Promise<ShippingResult> {
  const weightKg = packageWeightKg(input.items);
  const cost = shippingFee(input.localityType) + honeyJarSurcharge(honeyJarCount(input.items));
  return { cost, weightKg };
}
