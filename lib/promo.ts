import type { CartItem, Product, ProductVariant } from "@/types";

/**
 * "Al 11-lea gratuit" promotion: every FREE_JAR_STEP_KG of *paid* honey in the
 * cart earns one free 1kg jar. Propolis (category "apicole") never counts and is
 * never a valid free jar. All helpers here are pure so the same rules run in the
 * client cart and in the server-side checkout guard.
 */
export const FREE_JAR_STEP_KG = 10;

/** Net honey weight (kg) parsed from a variant label: "1kg" → 1,
 *  "Pachet 5 borcane (5kg)" → 5. Non-kg units (e.g. "20ml") → 0. */
export function honeyKgFromLabel(label: string): number {
  const match = label.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return match ? parseFloat(match[1].replace(",", ".")) : 0;
}

/** Net honey weight (kg) of a variant. */
export function variantHoneyKg(variant: ProductVariant): number {
  return honeyKgFromLabel(variant.weight ?? variant.type ?? "");
}

/** True for honey products that participate in the promotion. */
export function isHoney(product: Product): boolean {
  return product.category === "miere";
}

/** Total kg of *paid* honey in the cart (bonus jars and propolis excluded). */
export function paidHoneyKg(items: CartItem[]): number {
  return items.reduce((sum, i) => {
    if (i.isBonus || !isHoney(i.product)) return sum;
    return sum + variantHoneyKg(i.selectedVariant) * i.quantity;
  }, 0);
}

/** How many free jars the cart currently qualifies for. */
export function earnedFreeJars(items: CartItem[]): number {
  return Math.floor(paidHoneyKg(items) / FREE_JAR_STEP_KG);
}

/** How many bonus jars are actually in the cart right now. */
export function claimedFreeJars(items: CartItem[]): number {
  return items.reduce((sum, i) => (i.isBonus ? sum + i.quantity : sum), 0);
}

/**
 * Bonus jars claimed beyond what the cart currently qualifies for. These stay in
 * the cart but are shown as "indisponibil momentan" and dropped at checkout.
 * Positive when the customer removed paid honey after claiming a free jar.
 */
export function overclaimedFreeJars(items: CartItem[]): number {
  return Math.max(0, claimedFreeJars(items) - earnedFreeJars(items));
}

/** A new free jar is waiting to be chosen (earned more than claimed). */
export function unclaimedFreeJars(items: CartItem[]): number {
  return Math.max(0, earnedFreeJars(items) - claimedFreeJars(items));
}

/** Minimal shape of a checkout line, for the server-side promo guard. */
export interface CheckoutLine {
  productId: string;
  variant?: string;
  unitPrice: number;
  quantity: number;
  isBonus?: boolean;
}

/**
 * Server-side guard: recompute the free-jar entitlement from the *paid* lines
 * and drop any bonus jars beyond it, so a tampered payload can't smuggle in a
 * free item. Kept bonus lines are forced to price 0. `honeyCategoryOf` maps a
 * productId to its catalog category (so weight and honey-ness can't be faked).
 */
export function enforceBonusEntitlement<T extends CheckoutLine>(
  lines: T[],
  honeyCategoryOf: (productId: string) => Product["category"] | undefined
): T[] {
  const paidKg = lines.reduce((kg, l) => {
    if (l.isBonus || honeyCategoryOf(l.productId) !== "miere") return kg;
    return kg + honeyKgFromLabel(l.variant ?? "") * l.quantity;
  }, 0);
  const allowed = Math.floor(paidKg / FREE_JAR_STEP_KG);

  let kept = 0;
  return lines.flatMap((l) => {
    if (!l.isBonus) return [l];
    if (kept + l.quantity > allowed) return []; // over-entitlement → drop
    kept += l.quantity;
    return [{ ...l, unitPrice: 0 }];
  });
}
