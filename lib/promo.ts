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

/**
 * Bonus lines still within entitlement, by bonusKey. Each pool is capped on its
 * own — an overclaimed pack bonus must not mark a per-kg jar unavailable. The
 * first `available` bonus lines of each pool (in cart order) are orderable; the
 * rest are "indisponibil momentan" (kept in the cart UI, dropped at checkout).
 * Shared by the cart drawer and the checkout page so they always agree.
 */
export function orderableBonusKeys(items: CartItem[]): Set<number> {
  const kgLines = items.filter((i) => i.isBonus && bonusSourceOf(i) === "kg").length;
  const packLines = items.filter((i) => i.isBonus && bonusSourceOf(i) === "pack").length;
  const availableKg = kgLines - overclaimedFreeJars(items);
  const availablePack = packLines - overclaimedPackBonuses(items);
  let kgSeen = 0;
  let packSeen = 0;
  const keys = new Set<number>();
  for (const i of items) {
    if (!i.isBonus) continue;
    const ok = bonusSourceOf(i) === "kg" ? kgSeen++ < availableKg : packSeen++ < availablePack;
    if (ok && i.bonusKey != null) keys.add(i.bonusKey);
  }
  return keys;
}

/** Minimal shape of a checkout line, for the server-side promo guard. */
export interface CheckoutLine {
  productId: string;
  variant?: string;
  unitPrice: number;
  quantity: number;
  isBonus?: boolean;
  bonusSource?: BonusSource;
}

/**
 * Server-side guard: recompute both bonus entitlements from the *paid* lines and
 * drop any bonus beyond them, so a tampered payload can't smuggle in free items.
 * Each pool is capped independently. Pack bonuses are additionally checked
 * against the eligibility rules (no salcam) and their quantity is forced to the
 * catalog value (2 for propolis), so neither can be faked. Kept bonus lines are
 * forced to price 0. `catalogOf` maps a productId to its catalog product, so
 * category, pack-ness and bonus quantity all come from the server's data.
 */
export function enforceBonusEntitlement<T extends CheckoutLine>(
  lines: T[],
  catalogOf: (productId: string) => Product | undefined
): T[] {
  const variantOf = (line: CheckoutLine): ProductVariant | undefined =>
    catalogOf(line.productId)?.variants.find((v) => (v.weight ?? v.type) === line.variant);

  let paidKg = 0;
  let packs = 0;
  let triggerJars = 0;
  for (const line of lines) {
    if (line.isBonus || line.quantity <= 0 || catalogOf(line.productId)?.category !== "miere")
      continue;
    // Resolve the label against the catalog and take the weight from there: never
    // trust the client's kg claim. An unrecognized label earns nothing. This is
    // the same lookup that classifies pack-vs-trigger, so the two can't disagree.
    const variant = variantOf(line);
    if (!variant) continue;
    paidKg += variantHoneyKg(variant) * line.quantity;
    if (variant.bonusPack) packs += line.quantity;
    else triggerJars += line.quantity;
  }

  const allowedKg = Math.floor(paidKg / FREE_JAR_STEP_KG);
  const allowedPack = triggerJars >= 1 ? packs : 0;

  let keptKg = 0;
  let keptPack = 0;
  return lines.flatMap((line) => {
    if (!line.isBonus) return [line];
    if (line.quantity <= 0) return []; // a non-positive claim can't move either cap

    if (bonusSourceOf(line) === "kg") {
      // The per-kg promo grants a free 1kg honey jar (salcam allowed). Reject
      // anything else claimed as a kg bonus: unknown product, non-honey (e.g.
      // propolis), or a pack variant — the last would redeem a single-jar
      // entitlement as a whole 10kg pack.
      const product = catalogOf(line.productId);
      if (!product || !isHoney(product) || variantOf(line)?.bonusPack) return [];
      if (keptKg + line.quantity > allowedKg) return []; // over-entitlement → drop
      keptKg += line.quantity;
      return [{ ...line, unitPrice: 0 }];
    }

    const product = catalogOf(line.productId);
    if (!product || !isPackBonusEligible(product)) return []; // salcam or unknown
    if (keptPack + 1 > allowedPack) return [];
    keptPack += 1;
    return [{ ...line, unitPrice: 0, quantity: packBonusQuantity(product) }];
  });
}
