import type { BonusSource, CartItem, Product, ProductVariant } from "@/types";

/**
 * "Al 11-lea gratuit" promotion: every FREE_JAR_STEP_KG of *paid* honey in the
 * cart earns one free 1kg jar. Propolis (category "apicole") never counts and is
 * never a valid free jar. All helpers here are pure so the same rules run in the
 * client cart and in the server-side checkout guard.
 */
export const FREE_JAR_STEP_KG = 10;

const SALCAM_ID = "miere-salcam";
const PROPOLIS_ID = "tinctura-propolis";

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

/** Which promo a bonus line came from. Lines persisted before pack bonuses
 *  existed carry no source; they were all per-kg jars. Takes the bare shape so
 *  both cart items and checkout lines can use it, keeping that default in one place. */
export function bonusSourceOf(line: { bonusSource?: BonusSource }): BonusSource {
  return line.bonusSource ?? "kg";
}

/** Free jars from the per-kg promotion already in the cart. */
export function claimedFreeJars(items: CartItem[]): number {
  return items.reduce(
    (sum, i) => (i.isBonus && bonusSourceOf(i) === "kg" ? sum + i.quantity : sum),
    0
  );
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

/** True for a multi-jar pack variant carrying its own bonus. */
export function isPackVariant(variant: ProductVariant): boolean {
  return variant.bonusPack === true;
}

/** How many paid packs are in the cart. Honey-agnostic on purpose: any variant
 *  flagged bonusPack counts, so a future non-honey pack earns its bonus without
 *  a change here. Only rapița has the flag today. */
export function packCount(items: CartItem[]): number {
  return items.reduce((sum, i) => {
    if (i.isBonus || !isPackVariant(i.selectedVariant)) return sum;
    return sum + i.quantity;
  }, 0);
}

/** Paid honey jars that are not part of a pack — the pack bonus trigger. */
export function paidNonPackHoneyJars(items: CartItem[]): number {
  return items.reduce((sum, i) => {
    if (i.isBonus || !isHoney(i.product) || isPackVariant(i.selectedVariant)) return sum;
    return sum + i.quantity;
  }, 0);
}

/** One bonus per pack, locked until at least one non-pack paid honey jar is in
 *  the cart. The unlock is deliberately not proportional to the trigger jars:
 *  a single jar unlocks every pack's bonus, so this is not a missing
 *  Math.min(packCount, paidNonPackHoneyJars) — the count of jars past the first
 *  does not matter. */
export function earnedPackBonuses(items: CartItem[]): number {
  return paidNonPackHoneyJars(items) >= 1 ? packCount(items) : 0;
}

/** Pack bonuses already in the cart. Counted per line, not per unit: the propolis
 *  bonus is one claim with quantity 2, and counting units would spend two
 *  entitlements on it. Per-line counting is only correct while bonus lines are
 *  never merged: addBonusItem in lib/cart.ts guarantees it by always appending a
 *  new entry, bypassing addItem's merge on (productId, price) — which would
 *  otherwise fold two bonus lines together, since every bonus line has price 0. */
export function claimedPackBonuses(items: CartItem[]): number {
  return items.filter((i) => i.isBonus && bonusSourceOf(i) === "pack").length;
}

export function unclaimedPackBonuses(items: CartItem[]): number {
  return Math.max(0, earnedPackBonuses(items) - claimedPackBonuses(items));
}

/** Pack bonuses claimed beyond the entitlement (e.g. the trigger jar was removed).
 *  Shown as "indisponibil momentan" and dropped at checkout. */
export function overclaimedPackBonuses(items: CartItem[]): number {
  return Math.max(0, claimedPackBonuses(items) - earnedPackBonuses(items));
}

/** Products choosable as a pack bonus: every honey except salcam, plus propolis. */
export function isPackBonusEligible(product: Product): boolean {
  if (product.id === SALCAM_ID) return false;
  return isHoney(product) || product.id === PROPOLIS_ID;
}

/** Free units granted for a pack bonus: 2 propolis tinctures, or 1 honey jar. */
export function packBonusQuantity(product: Product): number {
  return product.id === PROPOLIS_ID ? 2 : 1;
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
