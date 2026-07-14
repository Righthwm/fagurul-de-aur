# Pachet 10 borcane rapiță +BONUS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 300 lei / 10-jar rapiță pack that stacks the existing per-kg free jar with a second, pack-specific bonus (no salcâm, propolis counts double).

**Architecture:** Two independent bonus pools tracked on the cart line via `bonusSource: "kg" | "pack"`. Pure functions in `lib/promo.ts` compute both pools and are reused verbatim by the client cart and the server-side checkout guard. The existing `FreeJarPopup` gains a mode and resolves both pending claims in one window; a new `BonusPackOffer` component owns the offer button and the "pick one more jar" popup.

**Tech Stack:** Next.js 16 (App Router), React 19, zustand (persisted cart), zod (checkout validation), framer-motion, vitest.

**Spec:** `docs/superpowers/specs/2026-07-14-pachet-bonus-rapita-design.md`

**Run tests with:** `npm test` (vitest run). Typecheck with `npx tsc --noEmit`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `types/index.ts` | Shared types | Modify — `bonusPack` on `ProductVariant`, `BonusSource` + `bonusSource` on `CartItem` |
| `lib/products.ts` | Catalog | Modify — pack variant on rapiță |
| `lib/promo.ts` | Both bonus pools + eligibility + server guard. Pure, no React. | Modify |
| `lib/promo.test.ts` | Unit tests for the above | Modify |
| `lib/shipping.test.ts` | Shipping fee for the pack | Modify |
| `lib/orders.ts` | zod schema + guard call site | Modify |
| `lib/cart.ts` | zustand store: bonus lines, pack-offer popup state | Modify |
| `components/shop/FreeJarPopup.tsx` | Popup 2 — claim the free jars (both pools) | Modify |
| `components/shop/BonusPackOffer.tsx` | Popup 1 — offer button + "pick one more jar" grid | **Create** |
| `app/miere/page.tsx` | Mount the offer | Modify |
| `components/shop/ProductDetail.tsx` | Mount the offer on the rapiță page | Modify |
| `app/checkout/page.tsx` | Per-pool availability + send `bonusSource` | Modify |

---

### Task 1: Catalog — the pack variant

**Files:**
- Modify: `types/index.ts:1-7`
- Modify: `lib/products.ts:154-156`
- Test: `lib/shipping.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/shipping.test.ts`, inside the existing top-level `describe`, right after the
`"adds the surcharge on top of the 50 lei rural fee..."` test:

```ts
  it("counts the 10-jar rapita pack as 10 jars", async () => {
    const pack = [{ productId: "miere-rapita", variantPrice: 300, quantity: 1 }];
    const result = await estimateShipping({ items: pack, ...urban });
    expect(result.cost).toBe(80); // 30 flat + 10×5, exactly at the threshold
    expect(result.weightKg).toBe(14); // 10 jars × 1.4kg gross
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shipping`
Expected: FAIL — `expected 35 to be 80`. The variant does not exist yet, so
`honeyJarCount` falls back to `variants[0]` (the 1kg jar) and bills a single jar.

- [ ] **Step 3: Add `bonusPack` to the variant type**

In `types/index.ts`, replace the `ProductVariant` interface:

```ts
export interface ProductVariant {
  weight?: string;
  type?: string;
  price: number;
  /** Shipping weight in kg (gross, incl. jar + packaging). Used for courier tariff. */
  weightKg?: number;
  /** Multi-jar pack granting its own bonus jar, separate from the per-kg promotion. */
  bonusPack?: boolean;
}
```

- [ ] **Step 4: Add the pack variant to rapiță**

In `lib/products.ts`, inside the `miere-rapita` product, replace the `variants` array:

```ts
    variants: [
      { weight: "1kg", price: 30, weightKg: 1.4 },
      // Keep the pack AFTER the 1kg jar. Several call sites fall back to
      // variants[0] when they cannot match a variant by price — bonus lines are
      // priced 0 and never match — and a pack in that slot would bill a free jar
      // as ten jars of shipping.
      { type: "Pachet 10 borcane (10kg)", price: 300, weightKg: 14, bonusPack: true },
    ],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/products.ts lib/shipping.test.ts
git commit -m "feat(promo): add the 10-jar rapita pack variant"
```

---

### Task 2: Both bonus pools in `lib/promo.ts`

**Files:**
- Modify: `types/index.ts` (CartItem)
- Modify: `lib/promo.ts`
- Test: `lib/promo.test.ts`

- [ ] **Step 1: Add the `bonusSource` type**

In `types/index.ts`, add above `CartItem`:

```ts
/** Which promotion granted a free line: the per-kg promo or a bonus pack. */
export type BonusSource = "kg" | "pack";
```

Then replace the `CartItem` interface:

```ts
export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant: ProductVariant;
  /** A free line earned through a promotion (price 0). */
  isBonus?: boolean;
  /** Which promotion granted it. Absent on paid items, and absent on bonus lines
   *  persisted before pack bonuses existed — treat those as "kg". */
  bonusSource?: BonusSource;
  /** Unique id for a bonus line (bonus jars all share price 0, so they need
   *  their own identity for removal). Absent on paid items. */
  bonusKey?: number;
}
```

- [ ] **Step 2: Write the failing tests**

In `lib/promo.test.ts`, extend the import block:

```ts
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
  isPackBonusEligible,
  packBonusQuantity,
} from "./promo";
import { products } from "./products";
import type { BonusSource, CartItem, ProductVariant } from "@/types";
```

Add these fixtures next to the existing `jar1kg` / `pack5kg`:

```ts
const pack10kg: ProductVariant = {
  type: "Pachet 10 borcane (10kg)",
  price: 300,
  weightKg: 14,
  bonusPack: true,
};
const propolis20ml: ProductVariant = { weight: "20ml", price: 15, weightKg: 0.2 };

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
```

Append these suites at the end of the file:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- promo`
Expected: FAIL — the new imports do not exist (`No "packCount" export is defined`).

- [ ] **Step 4: Implement the pool functions**

In `lib/promo.ts`, change the import line at the top to:

```ts
import type { BonusSource, CartItem, Product, ProductVariant } from "@/types";
```

Add below the `FREE_JAR_STEP_KG` constant:

```ts
const SALCAM_ID = "miere-salcam";
const PROPOLIS_ID = "tinctura-propolis";
```

Replace the existing `claimedFreeJars` with the source-filtered version, and add the
new helpers after it:

```ts
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

/** True for a multi-jar pack variant carrying its own bonus. */
export function isPackVariant(variant: ProductVariant): boolean {
  return variant.bonusPack === true;
}

/** How many paid packs are in the cart. */
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
 *  the cart. A single jar unlocks every pack's bonus. */
export function earnedPackBonuses(items: CartItem[]): number {
  return paidNonPackHoneyJars(items) >= 1 ? packCount(items) : 0;
}

/** Pack bonuses already in the cart. Counted per line, not per unit: the propolis
 *  bonus is one claim with quantity 2. Bonus lines never merge (unique bonusKey). */
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/promo.ts lib/promo.test.ts
git commit -m "feat(promo): track kg and pack bonus pools separately"
```

---

### Task 3: Server-side guard

**Files:**
- Modify: `lib/promo.ts:60-92` (`CheckoutLine`, `enforceBonusEntitlement`)
- Modify: `lib/orders.ts:34` (zod schema), `lib/orders.ts:72-73` (call site)
- Test: `lib/promo.test.ts`

A tampered payload must not smuggle in free items: no salcâm as a pack bonus, no
inflated propolis quantity, no pack bonus without a pack and a trigger jar.

- [ ] **Step 1: Write the failing tests**

Add `enforceBonusEntitlement` to the import block in `lib/promo.test.ts`, then append:

```ts
describe("enforceBonusEntitlement — pack pool", () => {
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  const paidPack = {
    productId: "miere-rapita",
    variant: "Pachet 10 borcane (10kg)",
    unitPrice: 300,
    quantity: 1,
  };
  const paidJar = { productId: "miere-tei", variant: "1kg", unitPrice: 30, quantity: 1 };
  const packBonus = (productId: string, variant: string, quantity = 1) => ({
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- promo`
Expected: FAIL — the guard still takes `honeyCategoryOf` and returns a category, so
passing `catalogOf` yields type errors and wrong behaviour.

- [ ] **Step 3: Rewrite the guard**

In `lib/promo.ts`, replace `CheckoutLine` and `enforceBonusEntitlement` entirely:

```ts
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
    if (line.isBonus || catalogOf(line.productId)?.category !== "miere") continue;
    paidKg += honeyKgFromLabel(line.variant ?? "") * line.quantity;
    if (variantOf(line)?.bonusPack) packs += line.quantity;
    else triggerJars += line.quantity;
  }

  const allowedKg = Math.floor(paidKg / FREE_JAR_STEP_KG);
  const allowedPack = triggerJars >= 1 ? packs : 0;

  let keptKg = 0;
  let keptPack = 0;
  return lines.flatMap((line) => {
    if (!line.isBonus) return [line];

    if (bonusSourceOf(line) === "kg") {
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
```

`bonusSourceOf` is structurally typed, so the same "kg when absent" default covers
both cart items and checkout lines without a cast.

- [ ] **Step 4: Update the call site and the zod schema**

In `lib/orders.ts`, add `bonusSource` to the items schema — replace the object inside
`items: z.array(...)`:

```ts
        .object({
          productId: z.string(),
          name: z.string(),
          variant: z.string().optional(),
          unitPrice: z.number().int().nonnegative(),
          quantity: z.number().int().positive(),
          isBonus: z.boolean().optional(),
          bonusSource: z.enum(["kg", "pack"]).optional(),
        })
```

Then replace the guard call (currently lines 72–73):

```ts
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  const orderedItems = enforceBonusEntitlement(input.items, catalogOf);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/promo.ts lib/promo.test.ts lib/orders.ts
git commit -m "feat(promo): enforce the pack bonus entitlement server-side"
```

---

### Task 4: Cart store

**Files:**
- Modify: `lib/cart.ts`

- [ ] **Step 1: Extend the imports**

In `lib/cart.ts`, replace the `@/lib/promo` import:

```ts
import {
  variantHoneyKg,
  earnedFreeJars,
  claimedFreeJars,
  unclaimedFreeJars,
  overclaimedFreeJars,
  earnedPackBonuses,
  claimedPackBonuses,
  unclaimedPackBonuses,
  overclaimedPackBonuses,
  packBonusQuantity,
} from "@/lib/promo";
```

and the types import:

```ts
import type { BonusSource, CartItem, Product, ProductVariant } from "@/types";
```

- [ ] **Step 2: Migrate persisted bonus lines**

In `reconcileItems`, replace the `if (item.isBonus)` block:

```ts
    // Bonus lines are always free — keep them at price 0 after refresh so a
    // catalog price change can never turn a free line into a paid one. Lines
    // persisted before pack bonuses existed carry no source; they were per-kg.
    if (item.isBonus) {
      return [
        {
          ...item,
          product,
          selectedVariant: { ...variant, price: 0 },
          bonusSource: item.bonusSource ?? "kg",
        },
      ];
    }
```

- [ ] **Step 3: Extend the store interface**

In `interface CartState`, replace the `bonusChooserOpen` line and the
`addBonusItem` signature, and add the new members:

```ts
  /** Whether the "choose your free jar" popup is showing. */
  bonusChooserOpen: boolean;
  /** Whether the pack offer popup ("pick one more jar") is showing. It suppresses
   *  the free-jar chooser so the two never stack. */
  packOfferOpen: boolean;
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  addBonusItem: (product: Product, source?: BonusSource) => void;
  removeBonusItem: (bonusKey: number) => void;
  openBonusChooser: () => void;
  closeBonusChooser: () => void;
  openPackOffer: () => void;
  closePackOffer: () => void;
```

and after the existing free-jar selectors:

```ts
  /** Pack bonuses the cart qualifies for (1 per pack, once a trigger jar exists). */
  earnedPackBonuses: () => number;
  /** Pack bonuses already in the cart. */
  claimedPackBonuses: () => number;
  /** A pack bonus is waiting to be chosen. */
  unclaimedPackBonuses: () => number;
  /** Pack bonuses claimed beyond the entitlement. */
  overclaimedPackBonuses: () => number;
```

- [ ] **Step 4: Implement the store changes**

Replace the initial state line `bonusChooserOpen: false,` with:

```ts
      bonusChooserOpen: false,
      packOfferOpen: false,
```

Replace `addBonusItem`:

```ts
      // Add a free line of the chosen product (price 0). Each claim is its own
      // line so availability ("indisponibil momentan") is tracked per line. The
      // propolis pack bonus is a single line of 2 tinctures.
      addBonusItem: (product, source = "kg") => {
        const base =
          product.variants.find((v) => variantHoneyKg(v) === 1) ?? product.variants[0];
        const bonusVariant: ProductVariant = { ...base, price: 0 };
        const quantity = source === "pack" ? packBonusQuantity(product) : 1;
        set((state) => ({
          items: [
            ...state.items,
            {
              product,
              quantity,
              selectedVariant: bonusVariant,
              isBonus: true,
              bonusSource: source,
              bonusKey: Date.now() + Math.floor(Math.random() * 1000),
            },
          ],
        }));
      },
```

Add after `closeBonusChooser`:

```ts
      openPackOffer: () => set({ packOfferOpen: true }),
      closePackOffer: () => set({ packOfferOpen: false }),
```

Add after `overclaimedFreeJars`:

```ts
      earnedPackBonuses: () => earnedPackBonuses(get().items),
      claimedPackBonuses: () => claimedPackBonuses(get().items),
      unclaimedPackBonuses: () => unclaimedPackBonuses(get().items),
      overclaimedPackBonuses: () => overclaimedPackBonuses(get().items),
```

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors. (`packOfferOpen` is not persisted — `partialize`
already keeps only `items`.)

- [ ] **Step 6: Commit**

```bash
git add lib/cart.ts
git commit -m "feat(cart): pack bonus lines and pack-offer popup state"
```

---

### Task 5: Popup 2 — the free-jar chooser gains a mode

**Files:**
- Modify: `components/shop/FreeJarPopup.tsx`

- [ ] **Step 1: Replace the imports and module-level lists**

In `components/shop/FreeJarPopup.tsx`, replace lines 1–12 (through
`const honeyProducts = ...`):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { products } from "@/lib/products";
import {
  isHoney,
  isPackBonusEligible,
  packBonusQuantity,
  unclaimedFreeJars,
  unclaimedPackBonuses,
} from "@/lib/promo";
import { ProductVisual } from "@/components/ui/ProductVisual";
import type { BonusSource } from "@/types";

// Per-kg promotion: any honey jar. Propolis is excluded.
const honeyProducts = products.filter(isHoney);
// Pack bonus: every honey except salcam, plus the propolis tincture.
const packBonusProducts = products.filter(isPackBonusEligible);
```

- [ ] **Step 2: Rework the component state**

Replace the body from `const items = useCartStore(...)` down to
`const next = () => ...` with:

```tsx
export function FreeJarPopup() {
  const items = useCartStore((s) => s.items);
  const bonusChooserOpen = useCartStore((s) => s.bonusChooserOpen);
  const packOfferOpen = useCartStore((s) => s.packOfferOpen);
  const openBonusChooser = useCartStore((s) => s.openBonusChooser);
  const closeBonusChooser = useCartStore((s) => s.closeBonusChooser);
  const addBonusItem = useCartStore((s) => s.addBonusItem);
  const openCart = useCartStore((s) => s.openCart);

  const kgPending = unclaimedFreeJars(items);
  const packPending = unclaimedPackBonuses(items);
  const pending = kgPending + packPending;
  // The per-kg claim comes first; the pack bonus follows in the same window.
  const mode: BonusSource = kgPending > 0 ? "kg" : "pack";
  const choices = mode === "kg" ? honeyProducts : packBonusProducts;

  const [index, setIndex] = useState(0);
  const prevPending = useRef(0);

  // Auto-open when a new bonus is earned; auto-close once none are pending.
  useEffect(() => {
    if (pending > prevPending.current) openBonusChooser();
    if (pending === 0) closeBonusChooser();
    prevPending.current = pending;
  }, [pending, openBonusChooser, closeBonusChooser]);

  // The two modes have different lists — restart the carousel when it switches.
  useEffect(() => {
    setIndex(0);
  }, [mode]);

  // Never stack on top of the pack offer popup; it opens by itself once that closes.
  const visible = bonusChooserOpen && !packOfferOpen && pending > 0;
  const product = choices[index] ?? choices[0];

  const prev = () => setIndex((i) => (i - 1 + choices.length) % choices.length);
  const next = () => setIndex((i) => (i + 1) % choices.length);

  const claim = () => {
    addBonusItem(product, mode);
    openCart();
  };
```

- [ ] **Step 3: Update the copy and the carousel list**

Replace the `aria-label` on the dialog:

```tsx
            aria-label={mode === "kg" ? "Alege borcanul gratuit" : "Alege bonusul pachetului"}
```

Replace the header block (`<h2>` and the `<p>` under it):

```tsx
            <h2 className="font-heading text-2xl text-text-primary">
              {mode === "kg"
                ? "Felicitări! Ați câștigat un borcan gratuit"
                : "Bonus pachet rapiță"}
            </h2>
            <p className="text-text-secondary text-sm mt-2 mb-6">
              {mode === "kg" ? "Alegeți ce miere doriți" : "Alegeți bonusul — fără salcâm"}
              {pending > 1 ? ` (${pending} de ales)` : ""}.
            </p>
```

Replace the dots `.map` source so it follows the active list:

```tsx
              {choices.map((p, i) => (
```

Replace the claim button:

```tsx
            <button onClick={claim} className="btn-primary w-full gap-2">
              <Gift size={16} />
              {mode === "pack" && packBonusQuantity(product) === 2
                ? "Adaugă 2 tincturi gratuit în coș"
                : "Adaugă gratuit în coș"}
            </button>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add components/shop/FreeJarPopup.tsx
git commit -m "feat(promo): let the free-jar chooser resolve both bonus pools"
```

---

### Task 6: Popup 1 — the offer button and jar picker

**Files:**
- Create: `components/shop/BonusPackOffer.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, X } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { products } from "@/lib/products";
import { isHoney } from "@/lib/promo";
import { ProductVisual } from "@/components/ui/ProductVisual";
import type { Product } from "@/types";

const rapita = products.find((p) => p.id === "miere-rapita")!;
const packVariant = rapita.variants.find((v) => v.bonusPack)!;
// The extra jar may be any honey — salcam included. Only the *free* pack bonus
// excludes it.
const jarChoices = products.filter(isHoney);

/**
 * The bonus pack offer: a button that drops the 10-jar rapita pack straight into
 * the cart, then invites the customer to add one more paid jar — which unlocks a
 * second free jar on top of the per-kg one the pack already earned. Closing the
 * popup without picking keeps the pack and its per-kg jar; the pack bonus stays
 * pending until a jar is added, from anywhere on the site.
 */
export function BonusPackOffer() {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const packOfferOpen = useCartStore((s) => s.packOfferOpen);
  const openPackOffer = useCartStore((s) => s.openPackOffer);
  const closePackOffer = useCartStore((s) => s.closePackOffer);

  const addPack = () => {
    addItem(rapita, packVariant);
    openPackOffer();
  };

  const chooseJar = (product: Product) => {
    const jar = product.variants.find((v) => v.weight === "1kg") ?? product.variants[0];
    addItem(product, jar);
    closePackOffer();
    openCart();
  };

  return (
    <>
      <button
        onClick={addPack}
        className="group flex flex-col items-center gap-0.5 rounded-lg border border-gold-400/40 bg-gold-400/10 px-6 py-4 text-center transition-colors hover:border-gold-400/70 hover:bg-gold-400/15"
      >
        <span className="font-heading text-lg text-text-primary">
          Pachet 10 borcane rapiță
        </span>
        <span className="font-heading text-2xl text-gold-300">300 lei</span>
        <span className="mt-1 text-sm text-text-secondary">
          <span aria-hidden="true">✦ </span>1 borcan{" "}
          <strong className="text-gold-300">GRATIS</strong> acum
        </span>
        <span className="text-sm text-text-secondary">
          <span aria-hidden="true">✦ </span>+1{" "}
          <strong className="text-gold-300">GRATIS</strong> dacă mai adaugi unul
        </span>
      </button>

      <AnimatePresence>
        {packOfferOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
              onClick={closePackOffer}
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Alege încă un borcan"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.35 }}
              className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gold-400/30 bg-bg-surface p-7 text-center shadow-2xl"
            >
              <button
                onClick={closePackOffer}
                className="absolute right-3 top-3 p-1.5 text-text-muted transition-colors hover:text-gold-300"
                aria-label="Închide"
              >
                <X size={18} />
              </button>

              <div className="mb-2 flex items-center justify-center gap-2 text-gold-300">
                <Sparkles size={16} />
                <Gift size={22} />
                <Sparkles size={16} />
              </div>
              <h2 className="font-heading text-2xl text-text-primary">
                Pachetul e în coș!
              </h2>
              <p className="mt-2 mb-6 text-sm text-text-secondary">
                Mai alege un borcan din catalog și mai primești{" "}
                <strong className="text-gold-300">încă un borcan gratis</strong>.
              </p>

              <ul className="grid grid-cols-3 gap-3">
                {jarChoices.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => chooseJar(p)}
                      className="flex w-full flex-col items-center gap-2 rounded-lg border border-gold-400/20 p-3 transition-colors hover:border-gold-400/60 hover:bg-gold-400/10"
                    >
                      <div className="flex h-20 items-end justify-center">
                        <ProductVisual product={p} width={54} />
                      </div>
                      <span className="text-xs leading-tight text-text-primary">{p.name}</span>
                      <span className="text-xs text-gold-300">{p.price} lei</span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add components/shop/BonusPackOffer.tsx
git commit -m "feat(promo): bonus pack offer button and jar picker popup"
```

---

### Task 7: Mount the offer

**Files:**
- Modify: `app/miere/page.tsx`
- Modify: `components/shop/ProductDetail.tsx`

- [ ] **Step 1: Mount on the shop page**

In `app/miere/page.tsx`, add the import:

```tsx
import { BonusPackOffer } from "@/components/shop/BonusPackOffer";
```

Then, directly after the closing `</div>` of the free-jar promotion callout block
(the `<div className="mt-7 flex justify-center">…</div>`), add:

```tsx
          <div className="mt-5 flex justify-center">
            <BonusPackOffer />
          </div>
```

- [ ] **Step 2: Mount on the rapiță product page**

In `components/shop/ProductDetail.tsx`, add the import:

```tsx
import { BonusPackOffer } from "@/components/shop/BonusPackOffer";
```

Then, directly after the closing `</div>` of the element containing the "Adaugă în coș"
button (the flex row at line ~227 with `className="btn-primary flex-1 gap-2"`), add:

```tsx
          {product.id === "miere-rapita" && (
            <div className="mt-5">
              <BonusPackOffer />
            </div>
          )}
```

- [ ] **Step 3: Verify in the running app**

Run: `npm run dev`, then open `http://localhost:3000/miere`.

Walk the whole flow and confirm each step:
1. The offer button shows all four lines and 300 lei.
2. Click it → the pack lands in the cart; popup 1 opens with a 6-jar grid; the
   free-jar chooser does **not** appear on top.
3. Pick a jar → popup 1 closes, the paid jar is in the cart, popup 2 opens saying
   "2 de ales".
4. First claim shows salcâm among the options; claim it.
5. Second claim is titled "Bonus pachet rapiță", shows **no** salcâm, and includes
   the propolis tincture.
6. Pick propolis → the cart holds 2 free tinctures on one line at 0 lei.
7. Cart total is 330 lei; shipping is 80 lei urban.

Then repeat, closing popup 1 with X instead: popup 2 must open with exactly **1** to
claim, and the pack bonus must appear later, after adding any honey jar from the shop.

- [ ] **Step 4: Commit**

```bash
git add app/miere/page.tsx components/shop/ProductDetail.tsx
git commit -m "feat(promo): surface the bonus pack on the shop and rapita pages"
```

---

### Task 8: Checkout — per-pool availability

**Files:**
- Modify: `app/checkout/page.tsx:88-96`, `app/checkout/page.tsx:260-267`

The "indisponibil momentan" filter currently pools all bonus lines together, so an
overclaimed pack bonus would drop an unrelated per-kg jar instead.

- [ ] **Step 1: Extend the promo import**

In `app/checkout/page.tsx`, add to the existing `@/lib/promo` import:

```tsx
import { bonusSourceOf, overclaimedFreeJars, overclaimedPackBonuses } from "@/lib/promo";
```

(Keep any other names already imported from that module.)

- [ ] **Step 2: Filter each pool independently**

Replace the block at lines 88–96 (from the `// Exclude bonus jars…` comment through
the `orderableKeys` line):

```tsx
  // Exclude bonus lines the cart no longer qualifies for ("indisponibil momentan")
  // from the order; the server re-validates the rest. Each pool is capped on its
  // own — an overclaimed pack bonus must not drop a per-kg jar. The last
  // `overclaimed` lines of each pool are the unavailable ones.
  const bonusesOf = (source: "kg" | "pack") =>
    items.filter((i) => i.isBonus && bonusSourceOf(i) === source).length;
  const availableKg = bonusesOf("kg") - overclaimedFreeJars(items);
  const availablePack = bonusesOf("pack") - overclaimedPackBonuses(items);
  let kgSeen = 0;
  let packSeen = 0;
  const orderableItems = items.filter((i) => {
    if (!i.isBonus) return true;
    return bonusSourceOf(i) === "kg" ? kgSeen++ < availableKg : packSeen++ < availablePack;
  });
  const orderableKeys = new Set(orderableItems.filter((i) => i.isBonus).map((i) => i.bonusKey));
```

- [ ] **Step 3: Send the source to the server**

In the payload builder (~line 260), replace the items mapping:

```tsx
      items: orderableItems.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        variant: i.selectedVariant.weight ?? i.selectedVariant.type,
        unitPrice: i.selectedVariant.price,
        quantity: i.quantity,
        isBonus: i.isBonus,
        bonusSource: i.bonusSource,
      })),
```

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all PASS, no errors.

Then with `npm run dev`: build the full cart (pack + jar + both bonuses), go to
`/checkout`, and confirm the order summary lists 330 lei of paid goods, both free
lines at 0 lei, and 80 lei shipping. Remove the paid tei jar from the cart and confirm
the **pack** bonus flips to "indisponibil momentan" while the per-kg jar stays
available.

- [ ] **Step 5: Commit**

```bash
git add app/checkout/page.tsx
git commit -m "feat(checkout): cap each bonus pool independently"
```

---

## Done when

- `npm test` passes, `npx tsc --noEmit` clean, `npm run lint` clean.
- The manual walkthrough in Task 7 Step 3 passes end to end.
- Task 8's checkout walkthrough passes.
