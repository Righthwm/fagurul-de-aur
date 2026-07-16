import { describe, it, expect } from "vitest";
import {
  variantHoneyKg,
  paidHoneyKg,
  earnedFreeJars,
  claimedFreeJars,
  overclaimedFreeJars,
  unclaimedFreeJars,
  packCount,
  paidNonPackHoneyJars,
  earnedPackBonuses,
  claimedPackBonuses,
  unclaimedPackBonuses,
  overclaimedPackBonuses,
  isPackBonusEligible,
  packBonusQuantity,
  enforceBonusEntitlement,
  orderableBonusKeys,
  type CheckoutLine,
} from "./promo";
import { products } from "./products";
import type { BonusSource, CartItem, ProductVariant } from "@/types";

const honey = (id: string) => products.find((p) => p.id === id)!;
const jar1kg: ProductVariant = { weight: "1kg", price: 30, weightKg: 1.4 };
const pack5kg: ProductVariant = { type: "Pachet 5 borcane (5kg)", price: 200, weightKg: 7 };
const pack10kg: ProductVariant = {
  type: "Pachet 10 borcane (10kg)",
  price: 300,
  weightKg: 14,
  bonusPack: true,
};
const propolis20ml: ProductVariant = { weight: "20ml", price: 15, weightKg: 0.2 };

function line(id: string, variant: ProductVariant = jar1kg, quantity = 1, isBonus = false): CartItem {
  return { product: honey(id), quantity, selectedVariant: variant, isBonus };
}

function bonusLine(id: string, source: BonusSource, quantity = 1): CartItem {
  return {
    product: honey(id),
    quantity,
    selectedVariant: { ...jar1kg, price: 0 },
    isBonus: true,
    bonusSource: source,
    bonusKey: Math.random(),
  };
}

describe("variantHoneyKg", () => {
  it("parses kg from the weight label", () => {
    expect(variantHoneyKg(jar1kg)).toBe(1);
  });
  it("parses kg from a pack type label", () => {
    expect(variantHoneyKg(pack5kg)).toBe(5);
  });
  it("is 0 for non-kg units like propolis 20ml", () => {
    expect(variantHoneyKg({ weight: "20ml", price: 15, weightKg: 0.2 })).toBe(0);
  });
});

describe("paidHoneyKg", () => {
  it("sums honey kg × quantity", () => {
    expect(paidHoneyKg([line("miere-tei", jar1kg, 4)])).toBe(4);
  });
  it("counts a 5kg pack as 5kg", () => {
    expect(paidHoneyKg([line("miere-salcam", pack5kg, 2)])).toBe(10);
  });
  it("excludes propolis", () => {
    const propolis = {
      product: honey("miere-tei") && products.find((p) => p.id === "tinctura-propolis")!,
      quantity: 3,
      selectedVariant: { weight: "20ml", price: 15, weightKg: 0.2 },
    };
    expect(paidHoneyKg([line("miere-tei", jar1kg, 6), propolis])).toBe(6);
  });
  it("excludes bonus jars", () => {
    expect(paidHoneyKg([line("miere-tei", jar1kg, 10), line("miere-munte", jar1kg, 1, true)])).toBe(10);
  });
});

describe("earned / claimed / overclaimed / unclaimed", () => {
  it("earns one jar per 10kg, rounding down", () => {
    expect(earnedFreeJars([line("miere-tei", jar1kg, 9)])).toBe(0);
    expect(earnedFreeJars([line("miere-tei", jar1kg, 10)])).toBe(1);
    expect(earnedFreeJars([line("miere-tei", jar1kg, 25)])).toBe(2);
  });

  it("tracks a freshly earned but unclaimed jar", () => {
    const cart = [line("miere-tei", jar1kg, 10)];
    expect(unclaimedFreeJars(cart)).toBe(1);
    expect(claimedFreeJars(cart)).toBe(0);
    expect(overclaimedFreeJars(cart)).toBe(0);
  });

  it("is settled once the bonus jar is added", () => {
    const cart = [line("miere-tei", jar1kg, 10), line("miere-munte", jar1kg, 1, true)];
    expect(unclaimedFreeJars(cart)).toBe(0);
    expect(claimedFreeJars(cart)).toBe(1);
    expect(overclaimedFreeJars(cart)).toBe(0);
  });

  it("flags an overclaimed jar when paid honey drops below the threshold", () => {
    const cart = [line("miere-tei", jar1kg, 8), line("miere-munte", jar1kg, 1, true)];
    expect(earnedFreeJars(cart)).toBe(0);
    expect(overclaimedFreeJars(cart)).toBe(1);
  });
});

describe("earnedPackBonuses", () => {
  it("is locked until a non-pack honey jar is in the cart", () => {
    expect(earnedPackBonuses([line("miere-rapita", pack10kg)])).toBe(0);
  });

  it("unlocks one bonus once a paid honey jar is added", () => {
    const cart = [line("miere-rapita", pack10kg), line("miere-tei", jar1kg)];
    expect(earnedPackBonuses(cart)).toBe(1);
  });

  it("accepts a paid 1kg rapita jar as the trigger", () => {
    const cart = [line("miere-rapita", pack10kg), line("miere-rapita", jar1kg)];
    expect(earnedPackBonuses(cart)).toBe(1);
  });

  it("grants one bonus per pack, unlocked by a single jar", () => {
    const cart = [line("miere-rapita", pack10kg, 2), line("miere-tei", jar1kg)];
    expect(earnedPackBonuses(cart)).toBe(2);
  });

  it("is not unlocked by propolis", () => {
    const cart = [line("miere-rapita", pack10kg), line("tinctura-propolis", propolis20ml)];
    expect(earnedPackBonuses(cart)).toBe(0);
  });

  it("is not unlocked by a free jar", () => {
    const cart = [line("miere-rapita", pack10kg), bonusLine("miere-tei", "kg")];
    expect(earnedPackBonuses(cart)).toBe(0);
  });
});

describe("overclaimedPackBonuses", () => {
  it("strands the claim when the trigger jar is removed", () => {
    const cart = [line("miere-rapita", pack10kg), bonusLine("miere-tei", "pack")];
    expect(earnedPackBonuses(cart)).toBe(0);
    expect(overclaimedPackBonuses(cart)).toBe(1);
    expect(unclaimedPackBonuses(cart)).toBe(0);
  });

  it("strands the claim when the pack itself is removed", () => {
    const cart = [line("miere-tei", jar1kg), bonusLine("miere-tei", "pack")];
    expect(earnedPackBonuses(cart)).toBe(0);
    expect(overclaimedPackBonuses(cart)).toBe(1);
    expect(unclaimedPackBonuses(cart)).toBe(0);
  });

  it("is settled while the pack and its trigger jar are both present", () => {
    const cart = [
      line("miere-rapita", pack10kg),
      line("miere-tei", jar1kg),
      bonusLine("miere-tei", "pack"),
    ];
    expect(overclaimedPackBonuses(cart)).toBe(0);
    expect(unclaimedPackBonuses(cart)).toBe(0);
  });
});

describe("pack and kg pools cumulate", () => {
  it("earns one kg jar and one pack bonus for a pack plus one jar", () => {
    const cart = [line("miere-rapita", pack10kg), line("miere-tei", jar1kg)];
    expect(paidHoneyKg(cart)).toBe(11);
    expect(earnedFreeJars(cart)).toBe(1);
    expect(earnedPackBonuses(cart)).toBe(1);
  });

  it("does not let a kg claim consume the pack entitlement", () => {
    const cart = [
      line("miere-rapita", pack10kg),
      line("miere-tei", jar1kg),
      bonusLine("miere-salcam", "kg"),
    ];
    expect(unclaimedFreeJars(cart)).toBe(0);
    expect(unclaimedPackBonuses(cart)).toBe(1);
  });

  it("counts a 2-tincture propolis bonus as a single pack claim", () => {
    const cart = [
      line("miere-rapita", pack10kg),
      line("miere-tei", jar1kg),
      bonusLine("tinctura-propolis", "pack", 2),
    ];
    expect(claimedPackBonuses(cart)).toBe(1);
    expect(unclaimedPackBonuses(cart)).toBe(0);
  });

  it("treats a legacy bonus line with no source as a per-kg jar", () => {
    const legacy: CartItem = {
      product: honey("miere-tei"),
      quantity: 1,
      selectedVariant: { ...jar1kg, price: 0 },
      isBonus: true,
    };
    const cart = [line("miere-tei", jar1kg, 10), legacy];
    expect(claimedFreeJars(cart)).toBe(1);
    expect(claimedPackBonuses(cart)).toBe(0);
  });
});

describe("packCount / paidNonPackHoneyJars", () => {
  it("counts paid packs only", () => {
    expect(packCount([line("miere-rapita", pack10kg, 2)])).toBe(2);
  });

  it("excludes pack jars from the trigger count", () => {
    const cart = [line("miere-rapita", pack10kg), line("miere-tei", jar1kg, 3)];
    expect(paidNonPackHoneyJars(cart)).toBe(3);
  });
});

describe("isPackBonusEligible", () => {
  it("excludes salcam", () => {
    expect(isPackBonusEligible(honey("miere-salcam"))).toBe(false);
  });
  it("excludes mana", () => {
    expect(isPackBonusEligible(honey("miere-mana"))).toBe(false);
  });
  it("includes other honey", () => {
    expect(isPackBonusEligible(honey("miere-tei"))).toBe(true);
  });
  it("includes propolis", () => {
    expect(isPackBonusEligible(honey("tinctura-propolis"))).toBe(true);
  });
});

describe("packBonusQuantity", () => {
  it("grants 2 propolis tinctures", () => {
    expect(packBonusQuantity(honey("tinctura-propolis"))).toBe(2);
  });
  it("grants 1 honey jar", () => {
    expect(packBonusQuantity(honey("miere-tei"))).toBe(1);
  });
});

describe("enforceBonusEntitlement — pack pool", () => {
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  const paidPack: CheckoutLine = {
    productId: "miere-rapita",
    variant: "Pachet 10 borcane (10kg)",
    unitPrice: 300,
    quantity: 1,
  };
  const paidJar: CheckoutLine = {
    productId: "miere-tei",
    variant: "1kg",
    unitPrice: 30,
    quantity: 1,
  };
  const packBonus = (productId: string, variant: string, quantity = 1): CheckoutLine => ({
    productId,
    variant,
    unitPrice: 0,
    quantity,
    isBonus: true,
    bonusSource: "pack" as const,
  });

  it("drops a salcam pack bonus", () => {
    const kept = enforceBonusEntitlement(
      [paidPack, paidJar, packBonus("miere-salcam", "1kg")],
      catalogOf
    );
    expect(kept.some((l) => l.productId === "miere-salcam")).toBe(false);
  });

  it("forces a tampered propolis bonus quantity back to 2", () => {
    const kept = enforceBonusEntitlement(
      [paidPack, paidJar, packBonus("tinctura-propolis", "20ml", 10)],
      catalogOf
    );
    expect(kept.find((l) => l.productId === "tinctura-propolis")?.quantity).toBe(2);
  });

  it("drops a pack bonus when no pack is in the cart", () => {
    const kept = enforceBonusEntitlement([paidJar, packBonus("miere-tei", "1kg")], catalogOf);
    expect(kept.filter((l) => l.isBonus)).toHaveLength(0);
  });

  it("drops a pack bonus when no trigger jar is in the cart", () => {
    const kept = enforceBonusEntitlement([paidPack, packBonus("miere-tei", "1kg")], catalogOf);
    expect(kept.filter((l) => l.isBonus)).toHaveLength(0);
  });

  it("keeps one bonus from each pool and prices both at 0", () => {
    const kgBonus = {
      productId: "miere-salcam",
      variant: "1kg",
      unitPrice: 0,
      quantity: 1,
      isBonus: true,
      bonusSource: "kg" as const,
    };
    const kept = enforceBonusEntitlement(
      [paidPack, paidJar, kgBonus, packBonus("miere-tei", "1kg")],
      catalogOf
    );
    const bonuses = kept.filter((l) => l.isBonus);
    expect(bonuses).toHaveLength(2);
    expect(bonuses.every((l) => l.unitPrice === 0)).toBe(true);
  });
});

describe("enforceBonusEntitlement — kg pool", () => {
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  // 10kg of paid honey earns exactly one kg-pool free 1kg jar.
  const paidTenKg: CheckoutLine = {
    productId: "miere-tei",
    variant: "1kg",
    unitPrice: 30,
    quantity: 10,
  };
  const kgBonus = (productId: string, variant: string, quantity = 1): CheckoutLine => ({
    productId,
    variant,
    unitPrice: 0,
    quantity,
    isBonus: true,
    bonusSource: "kg" as const,
  });

  it("keeps a legit salcam 1kg jar as a kg bonus at price 0", () => {
    const kept = enforceBonusEntitlement([paidTenKg, kgBonus("miere-salcam", "1kg")], catalogOf);
    const bonus = kept.find((l) => l.isBonus);
    expect(bonus).toBeDefined();
    expect(bonus?.unitPrice).toBe(0);
  });

  it("drops a pack variant claimed as a kg bonus", () => {
    const kept = enforceBonusEntitlement(
      [paidTenKg, kgBonus("miere-rapita", "Pachet 10 borcane (10kg)")],
      catalogOf
    );
    expect(kept.filter((l) => l.isBonus)).toHaveLength(0);
  });

  it("drops an unknown product claimed as a kg bonus", () => {
    const kept = enforceBonusEntitlement(
      [paidTenKg, kgBonus("not-a-real-product", "1kg")],
      catalogOf
    );
    expect(kept.filter((l) => l.isBonus)).toHaveLength(0);
  });

  it("keeps propolis as a kg bonus, delivered as 2 tinctures", () => {
    const kept = enforceBonusEntitlement(
      [paidTenKg, kgBonus("tinctura-propolis", "20ml")],
      catalogOf
    );
    const bonus = kept.find((l) => l.isBonus);
    expect(bonus).toBeDefined();
    expect(bonus?.unitPrice).toBe(0);
    expect(bonus?.quantity).toBe(2);
  });

  it("keeps the earned free jar for a legit 10kg cart (positive control)", () => {
    const kept = enforceBonusEntitlement([paidTenKg, kgBonus("miere-tei", "1kg")], catalogOf);
    const bonus = kept.find((l) => l.isBonus);
    expect(bonus).toBeDefined();
    expect(bonus?.unitPrice).toBe(0);
  });

  it("ignores a forged oversized variant label on a paid line", () => {
    // One real cheap jar, but the label lies about its weight. The catalog has no
    // "999kg" variant, so no kg entitlement is earned and every bonus is dropped.
    const forgedPaid: CheckoutLine = {
      productId: "miere-tei",
      variant: "999kg",
      unitPrice: 30,
      quantity: 1,
    };
    const kept = enforceBonusEntitlement(
      [forgedPaid, kgBonus("miere-tei", "1kg"), kgBonus("miere-tei", "1kg")],
      catalogOf
    );
    expect(kept.filter((l) => l.isBonus)).toHaveLength(0);
  });

  it("a negative-quantity bonus line can't lift the cap for a later line", () => {
    // 10kg paid honey earns exactly 1 kg bonus. The -1000 line is dropped outright
    // (non-positive) and never touches the running tally; the following line is kept
    // as a single claim with its quantity normalized to one jar, so a forged quantity
    // can't over-redeem.
    const kept = enforceBonusEntitlement(
      [paidTenKg, kgBonus("miere-tei", "1kg", -1000), kgBonus("miere-tei", "1kg", 999)],
      catalogOf
    );
    const bonuses = kept.filter((l) => l.isBonus);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0].quantity).toBe(1);
  });
});

describe("orderableBonusKeys", () => {
  it("keeps both bonus keys when the cart is fully settled", () => {
    const kgBonus = bonusLine("miere-salcam", "kg");
    const packBonus = bonusLine("miere-tei", "pack");
    const cart = [
      line("miere-rapita", pack10kg),
      line("miere-tei", jar1kg),
      kgBonus,
      packBonus,
    ];
    const keys = orderableBonusKeys(cart);
    expect(keys.has(kgBonus.bonusKey!)).toBe(true);
    expect(keys.has(packBonus.bonusKey!)).toBe(true);
  });

  it("keeps the kg bonus but drops the pack bonus when the trigger jar is removed", () => {
    // Pack alone still earns 10kg → the kg jar stays entitled, but with no
    // non-pack trigger jar, earnedPackBonuses is 0 → the pack bonus is stranded.
    // This is the exact cross-pool bug: the kg jar must not be marked unavailable.
    const kgBonus = bonusLine("miere-salcam", "kg");
    const packBonus = bonusLine("miere-tei", "pack");
    const cart = [line("miere-rapita", pack10kg), kgBonus, packBonus];
    const keys = orderableBonusKeys(cart);
    expect(keys.has(kgBonus.bonusKey!)).toBe(true);
    expect(keys.has(packBonus.bonusKey!)).toBe(false);
  });

  it("is empty for a cart with only paid items", () => {
    const cart = [line("miere-tei", jar1kg, 10), line("miere-rapita", pack10kg)];
    expect(orderableBonusKeys(cart).size).toBe(0);
  });
});

describe("payment gate — orderableBonusKeys", () => {
  it("returns an empty set for ramburs, no matter what's earned", () => {
    const cart = [
      line("miere-rapita", pack10kg),
      line("miere-tei", jar1kg),
      bonusLine("miere-tei", "kg"),
      bonusLine("tinctura-propolis", "pack", 2),
    ];
    expect(orderableBonusKeys(cart, false).size).toBe(0);
  });

  it("is unchanged for card (default stays card)", () => {
    const cart = [
      line("miere-rapita", pack10kg),
      line("miere-tei", jar1kg),
      bonusLine("miere-tei", "kg"),
      bonusLine("tinctura-propolis", "pack", 2),
    ];
    expect(orderableBonusKeys(cart, true)).toEqual(orderableBonusKeys(cart));
    expect(orderableBonusKeys(cart).size).toBe(2);
  });
});

describe("payment gate — enforceBonusEntitlement", () => {
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  const paidPack: CheckoutLine = {
    productId: "miere-rapita",
    variant: "Pachet 10 borcane (10kg)",
    unitPrice: 300,
    quantity: 1,
  };
  const paidJar: CheckoutLine = { productId: "miere-tei", variant: "1kg", unitPrice: 30, quantity: 1 };
  const kgBonus: CheckoutLine = {
    productId: "miere-tei",
    variant: "1kg",
    unitPrice: 0,
    quantity: 1,
    isBonus: true,
    bonusSource: "kg" as const,
  };
  const packBonus: CheckoutLine = {
    productId: "tinctura-propolis",
    variant: "20ml",
    unitPrice: 0,
    quantity: 2,
    isBonus: true,
    bonusSource: "pack" as const,
  };

  it("strips every bonus line for ramburs, keeps paid lines", () => {
    const kept = enforceBonusEntitlement([paidPack, paidJar, kgBonus, packBonus], catalogOf, false);
    expect(kept.filter((l) => l.isBonus)).toHaveLength(0);
    expect(kept.map((l) => l.productId)).toEqual(["miere-rapita", "miere-tei"]);
  });

  it("keeps entitled bonuses for card (default stays card)", () => {
    const kept = enforceBonusEntitlement([paidPack, paidJar, kgBonus, packBonus], catalogOf, true);
    expect(kept.filter((l) => l.isBonus)).toHaveLength(2);
    expect(enforceBonusEntitlement([paidPack, paidJar, kgBonus, packBonus], catalogOf)).toEqual(kept);
  });
});
