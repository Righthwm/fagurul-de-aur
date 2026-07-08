import { products } from "@/lib/products";
import { shippingFee } from "@/lib/constants";

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

export interface ShippingResult {
  /** Flat delivery fee in lei: 30 for urban localities, 50 for rural ones. */
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
 * checkout route. A flat two-tier fee: 30 lei to a city (oraș), 50 lei to a
 * village (sat), based on the delivery locality.
 */
export async function estimateShipping(input: EstimateInput): Promise<ShippingResult> {
  const weightKg = packageWeightKg(input.items);
  const cost = shippingFee(input.localityType);
  return { cost, weightKg };
}
