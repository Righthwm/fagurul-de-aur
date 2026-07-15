import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/lib/cart";
import { products } from "@/lib/products";
import {
  enforceBonusEntitlement,
  orderableBonusKeys,
  isPackBonusEligible,
  type CheckoutLine,
} from "@/lib/promo";
import type { CartItem, Product } from "@/types";

/**
 * End-to-end flow of the "Pachet 10 borcane rapiță" offer, driven through the
 * real cart store, promo pool functions, and the server-side entitlement guard
 * in the same sequence the UI produces. No DOM: the popups are thin wrappers over
 * these store actions, so this exercises everything below the click.
 */

const rapita = products.find((p) => p.id === "miere-rapita")!;
const tei = products.find((p) => p.id === "miere-tei")!;
const salcam = products.find((p) => p.id === "miere-salcam")!;
const propolis = products.find((p) => p.id === "tinctura-propolis")!;
const packVariant = rapita.variants.find((v) => v.bonusPack)!;
const jar1kg = (p: Product) => p.variants.find((v) => v.weight === "1kg") ?? p.variants[0];

const catalogOf = (id: string) => products.find((p) => p.id === id);

/** Build the checkout payload lines exactly as app/checkout/page.tsx does. */
function toCheckoutLines(items: CartItem[]): CheckoutLine[] {
  const orderableKeys = orderableBonusKeys(items);
  return items
    .filter((i) => !i.isBonus || orderableKeys.has(i.bonusKey!))
    .map((i) => ({
      productId: i.product.id,
      variant: i.selectedVariant.weight ?? i.selectedVariant.type,
      unitPrice: i.selectedVariant.price,
      quantity: i.quantity,
      isBonus: i.isBonus,
      bonusSource: i.bonusSource,
    }));
}

describe("bonus-pack flow (store → promo → server guard)", () => {
  beforeEach(() => useCartStore.getState().clearCart());

  it("the pack alone earns the kg jar but locks the pack bonus", () => {
    const store = useCartStore.getState();
    store.addItem(rapita, packVariant); // the offer button

    const s = useCartStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.earnedFreeJars()).toBe(1); // 10kg pack clears the 10kg threshold
    expect(s.earnedPackBonuses()).toBe(0); // no non-pack trigger jar yet
    expect(s.unclaimedPackBonuses()).toBe(0);
  });

  it("adding a paid jar unlocks the pack bonus; both pools then resolve", () => {
    const store = useCartStore.getState();
    store.addItem(rapita, packVariant); // offer
    store.addItem(tei, jar1kg(tei)); // "pick one more jar" — the trigger

    let s = useCartStore.getState();
    expect(s.earnedFreeJars()).toBe(1);
    expect(s.earnedPackBonuses()).toBe(1);
    expect(s.unclaimedFreeJars()).toBe(1);
    expect(s.unclaimedPackBonuses()).toBe(1);

    // Popup 2 resolves kg first (salcâm allowed), then the pack bonus.
    store.addBonusItem(salcam, "kg");
    store.addBonusItem(propolis, "pack");

    s = useCartStore.getState();
    expect(s.unclaimedFreeJars()).toBe(0);
    expect(s.unclaimedPackBonuses()).toBe(0);

    const bonusLines = s.items.filter((i) => i.isBonus);
    expect(bonusLines).toHaveLength(2);
    const salcamBonus = bonusLines.find((i) => i.product.id === "miere-salcam")!;
    const propolisBonus = bonusLines.find((i) => i.product.id === "tinctura-propolis")!;
    expect(salcamBonus.quantity).toBe(1);
    expect(salcamBonus.selectedVariant.price).toBe(0);
    expect(propolisBonus.quantity).toBe(2); // propolis pack bonus = 2 tinctures
    expect(propolisBonus.selectedVariant.price).toBe(0);

    // Paid goods: 300 (pack) + 30 (tei) = 330; bonuses are free.
    expect(s.totalPrice()).toBe(330);

    // The server guard keeps both bonuses at price 0 and forces propolis to 2.
    const kept = enforceBonusEntitlement(toCheckoutLines(s.items), catalogOf);
    const keptBonuses = kept.filter((l) => l.isBonus);
    expect(keptBonuses).toHaveLength(2);
    expect(keptBonuses.every((l) => l.unitPrice === 0)).toBe(true);
    expect(kept.find((l) => l.productId === "tinctura-propolis")?.quantity).toBe(2);
    // Paid lines survive untouched.
    expect(kept.find((l) => l.productId === "miere-rapita" && !l.isBonus)?.unitPrice).toBe(300);
  });

  it("removing the trigger jar strands the pack bonus but keeps the kg jar", () => {
    const store = useCartStore.getState();
    store.addItem(rapita, packVariant);
    store.addItem(tei, jar1kg(tei));
    store.addBonusItem(salcam, "kg");
    store.addBonusItem(propolis, "pack");

    // Remove the paid tei jar — the pack bonus's trigger.
    store.removeItem(tei.id, jar1kg(tei).price);

    const s = useCartStore.getState();
    expect(s.earnedFreeJars()).toBe(1); // pack alone still = 10kg
    expect(s.earnedPackBonuses()).toBe(0); // trigger gone
    expect(s.overclaimedPackBonuses()).toBe(1);
    expect(s.overclaimedFreeJars()).toBe(0);

    // The drawer/checkout availability: kg bonus stays, pack bonus is dropped.
    const orderable = orderableBonusKeys(s.items);
    const salcamBonus = s.items.find((i) => i.isBonus && i.product.id === "miere-salcam")!;
    const propolisBonus = s.items.find((i) => i.isBonus && i.product.id === "tinctura-propolis")!;
    expect(orderable.has(salcamBonus.bonusKey!)).toBe(true);
    expect(orderable.has(propolisBonus.bonusKey!)).toBe(false);

    // The server guard agrees: only the kg (salcâm) bonus survives, at price 0.
    const kept = enforceBonusEntitlement(toCheckoutLines(s.items), catalogOf);
    const keptBonuses = kept.filter((l) => l.isBonus);
    expect(keptBonuses).toHaveLength(1);
    expect(keptBonuses[0].productId).toBe("miere-salcam");
    expect(keptBonuses[0].unitPrice).toBe(0);
  });

  it("salcâm is offered for the kg jar but never for the pack bonus", () => {
    // Popup 2's product lists are driven by these predicates.
    expect(isPackBonusEligible(salcam)).toBe(false); // pack bonus excludes salcâm
    expect(isPackBonusEligible(tei)).toBe(true);
    expect(isPackBonusEligible(propolis)).toBe(true); // propolis allowed as pack bonus
  });

  it("a ramburs order excludes every bonus jar", () => {
    const store = useCartStore.getState();
    store.addItem(rapita, packVariant);
    store.addItem(tei, jar1kg(tei));
    store.addBonusItem(salcam, "kg");
    store.addBonusItem(propolis, "pack");

    const items = useCartStore.getState().items;
    // Card: both bonuses survive the guard.
    const card = enforceBonusEntitlement(toCheckoutLines(items), catalogOf, true);
    expect(card.filter((l) => l.isBonus)).toHaveLength(2);
    // Ramburs: no bonus survives; paid pack + paid jar remain.
    const ramburs = enforceBonusEntitlement(toCheckoutLines(items), catalogOf, false);
    expect(ramburs.filter((l) => l.isBonus)).toHaveLength(0);
    expect(ramburs.map((l) => l.productId).sort()).toEqual(["miere-rapita", "miere-tei"]);
  });
});
