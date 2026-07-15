# Card-only bonus jars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every free/bonus jar (per-kg promo + pack bonus) orderable only when the customer pays by card; at ramburs they're shown "Doar cu plata card" and excluded from the order.

**Architecture:** One principle — a bonus is orderable iff it's within its pool's entitlement AND payment is by card. The entitlement half already exists (`orderableBonusKeys`); we add a `cardPayment` gate as a defaulted parameter to the two pure functions (`orderableBonusKeys`, `enforceBonusEntitlement`), so existing callers are untouched. Checkout passes the live payment method; the server guard enforces it authoritatively.

**Tech Stack:** Next.js 16 (App Router), React 19, react-hook-form, zod, zustand, vitest.

**Spec:** `docs/superpowers/specs/2026-07-15-bonusuri-doar-cu-cardul-design.md`

**Run tests with:** `npm test` (vitest run). Typecheck: `npx tsc --noEmit`. Lint baseline on main is 27 errors — a change must add none.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `lib/promo.ts` | Pure entitlement + payment gate | Modify — `cardPayment` param on `orderableBonusKeys` and `enforceBonusEntitlement` |
| `lib/promo.test.ts` | Unit tests for the gate | Modify |
| `lib/orders.ts` | Server guard call site | Modify — pass payment method |
| `app/checkout/page.tsx` | Gate the UI, estimate, labels, nudge | Modify |
| `components/shop/CartDrawer.tsx` | Informational note on bonus lines | Modify |
| `lib/bonus-pack-flow.test.ts` | End-to-end ramburs case | Modify |

---

### Task 1: Payment gate in the pure functions

**Files:**
- Modify: `lib/promo.ts` (`orderableBonusKeys`, `enforceBonusEntitlement`)
- Test: `lib/promo.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/promo.test.ts`. (The file already imports `orderableBonusKeys`, `enforceBonusEntitlement`, `products`, and has `line`/`bonusLine` helpers and the `pack10kg` fixture — reuse them; add imports only if missing.)

```ts
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
  const paidPack = {
    productId: "miere-rapita",
    variant: "Pachet 10 borcane (10kg)",
    unitPrice: 300,
    quantity: 1,
  };
  const paidJar = { productId: "miere-tei", variant: "1kg", unitPrice: 30, quantity: 1 };
  const kgBonus = {
    productId: "miere-tei",
    variant: "1kg",
    unitPrice: 0,
    quantity: 1,
    isBonus: true,
    bonusSource: "kg" as const,
  };
  const packBonus = {
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
```

The `jar1kg` fixture already exists at the top of `lib/promo.test.ts` (`{ weight: "1kg", price: 30, weightKg: 1.4 }`). If a test above references a fixture not present, add it next to the existing ones — do not redefine an existing one.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- promo`
Expected: FAIL — `orderableBonusKeys`/`enforceBonusEntitlement` don't accept a second/third argument yet, so the ramburs cases return the full set / keep bonuses.

- [ ] **Step 3: Add the gate to `orderableBonusKeys`**

In `lib/promo.ts`, change the signature and add an early return as the FIRST line of the body:

```ts
export function orderableBonusKeys(items: CartItem[], cardPayment = true): Set<number> {
  if (!cardPayment) return new Set(); // ramburs: no bonus jar is orderable
  const kgLines = items.filter((i) => i.isBonus && bonusSourceOf(i) === "kg").length;
  // ...rest of the existing body unchanged...
```

Leave the entire rest of the function body exactly as it is.

- [ ] **Step 4: Add the gate to `enforceBonusEntitlement`**

In `lib/promo.ts`, change the signature and add an early return as the FIRST line of the body:

```ts
export function enforceBonusEntitlement<T extends CheckoutLine>(
  lines: T[],
  catalogOf: (productId: string) => Product | undefined,
  cardPayment = true
): T[] {
  if (!cardPayment) return lines.filter((l) => !l.isBonus); // ramburs: drop all bonuses
  const variantOf = (line: CheckoutLine): ProductVariant | undefined =>
  // ...rest of the existing body unchanged...
```

Leave the entire rest of the function body exactly as it is. Update the JSDoc above the function to note: "Bonuses are granted only when `cardPayment` is true; a ramburs order drops all bonus lines."

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/promo.ts lib/promo.test.ts
git commit -m "feat(promo): gate bonus jars behind card payment"
```

---

### Task 2: Server guard passes the payment method

**Files:**
- Modify: `lib/orders.ts` (the `enforceBonusEntitlement` call, ~line 74)

- [ ] **Step 1: Update the guard call**

In `lib/orders.ts`, find:

```ts
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  const orderedItems = enforceBonusEntitlement(input.items, catalogOf);
```

and change the second line to pass the payment flag:

```ts
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  const orderedItems = enforceBonusEntitlement(input.items, catalogOf, input.paymentMethod === "card");
```

`input.paymentMethod` is `"card" | "ramburs"` (from `checkoutInputSchema`). Everything downstream (`cartSubtotal`, `estimateShipping`, persisted `items`) already reads `orderedItems`, so a ramburs order now excludes bonuses from totals, shipping, and storage automatically.

- [ ] **Step 2: Verify**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/orders.ts
git commit -m "feat(checkout): drop bonus jars from ramburs orders server-side"
```

---

### Task 3: Checkout UI — gate, estimate, labels, nudge

**Files:**
- Modify: `app/checkout/page.tsx`

- [ ] **Step 1: Gate `orderableKeys` on the payment method**

In `app/checkout/page.tsx`, find (~line 90):

```tsx
  const orderableKeys = orderableBonusKeys(items);
```

`paymentMethod` is defined a bit further down via `watch("paymentMethod")`. Move the `orderableKeys` computation to AFTER `paymentMethod` is available, or read the form value directly. The simplest correct change: `paymentMethod` is declared at line ~124 (`const paymentMethod = watch("paymentMethod");`). Relocate the two lines that compute `orderableKeys`/`orderableItems` to just below that declaration, and gate them:

```tsx
  const paymentMethod = watch("paymentMethod");
  const orderableKeys = orderableBonusKeys(items, paymentMethod === "card");
  const orderableItems = items.filter((i) => !i.isBonus || orderableKeys.has(i.bonusKey!));
```

Delete the old `const orderableKeys = orderableBonusKeys(items);` and the old `const orderableItems = ...` lines from their previous location (~lines 90-91) so they're defined exactly once, after `paymentMethod`. Verify `orderableItems`/`orderableKeys` aren't referenced ABOVE the new location (they're used in the JSX and payload, which are below).

- [ ] **Step 2: Send the gated items to the shipping estimate**

In the estimate effect (~line 182), the body currently maps over `items`:

```tsx
          items: items.map((i) => ({
            productId: i.product.id,
            variantPrice: i.selectedVariant.price,
            quantity: i.quantity,
          })),
```

Change the map source to `orderableItems` so a ramburs cart doesn't bill shipping for excluded bonus jars:

```tsx
          items: orderableItems.map((i) => ({
            productId: i.product.id,
            variantPrice: i.selectedVariant.price,
            quantity: i.quantity,
          })),
```

The effect's dependency array is `[mounted, county, locality, paymentMethod, itemsSig]` with `eslint-disable-next-line react-hooks/exhaustive-deps` already present — `paymentMethod` is a dep, so switching card↔ramburs re-runs the estimate. Leave the deps as-is.

- [ ] **Step 3: Label the greyed line by reason (payment vs entitlement)**

In the order-summary item map (~line 584), the current line is:

```tsx
                            {bonusUnavailable && <span className="text-amber-300"> · indisponibil momentan</span>}
```

Replace it so a ramburs-gated bonus reads differently from an over-entitled one:

```tsx
                            {bonusUnavailable && (
                              <span className="text-amber-300">
                                {paymentMethod === "card" ? " · indisponibil momentan" : " · doar cu plata card"}
                              </span>
                            )}
```

(The line-through styling at ~line 590, driven by `bonusUnavailable`, already applies in both cases — no change there.)

- [ ] **Step 4: Add the card nudge under the payment selector**

In `app/checkout/page.tsx`, immediately AFTER the payment radiogroup `</div>` (~line 491, the `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5" ...>` that closes at 491) and BEFORE the `{paymentMethod === "card" && cardEnabled && (` block, insert:

```tsx
              {paymentMethod !== "card" && items.some((i) => i.isBonus) && (
                <div className="mb-5 flex items-start gap-2 rounded-sm border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-text-primary">
                  <CreditCard size={18} className="text-gold-300 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-gold-300">Plătește cu cardul</strong> și primești{" "}
                    {items.filter((i) => i.isBonus).length === 1
                      ? "borcanul gratuit"
                      : `cele ${items.filter((i) => i.isBonus).length} borcane gratuite`}
                    . La plata ramburs, borcanele bonus nu sunt incluse.
                  </span>
                </div>
              )}
```

`CreditCard` is already imported in this file (used by the card option). No new import needed.

- [ ] **Step 5: Verify (types, lint, and the flow in the running app)**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tests pass, no type errors, lint adds nothing beyond the 27-error main baseline.

Then drive it. A dev server may already be running on :3000 (if so, curl/use it; don't kill a server you didn't start). Otherwise start one in the background, wait for ready, and check. Add a pack + a jar to the cart, claim both free jars, go to `/checkout`, then:
1. With **Ramburs** selected: both bonus lines in the summary show "· doar cu plata card" and are struck through; the nudge appears; the shipping estimate excludes the bonus jars.
2. Switch to **Card**: the bonuses un-grey (no strikethrough, "Gratuit" in green); the nudge disappears; shipping re-estimates including the bonus jars.
3. Switch back to **Ramburs**: bonuses grey out again (they stay in the cart, not removed).

- [ ] **Step 6: Commit**

```bash
git add app/checkout/page.tsx
git commit -m "feat(checkout): show bonus jars as card-only, nudge card payment"
```

---

### Task 4: Cart drawer informational note

**Files:**
- Modify: `components/shop/CartDrawer.tsx`

The drawer doesn't know the payment method (chosen at checkout), so it only informs — no gating. Add a small note under each bonus line.

- [ ] **Step 1: Add the note**

In `components/shop/CartDrawer.tsx`, find the bonus line's sub-label (the paragraph that renders the variant and "borcan bonus", around line 224):

```tsx
                          <p className="text-text-muted text-xs mt-0.5">
                            {item.selectedVariant.weight ?? item.selectedVariant.type} · borcan bonus
                          </p>
```

Immediately AFTER that `</p>`, add:

```tsx
                          <p className="text-gold-300/80 text-[11px] mt-0.5">Gratuite la plata cu cardul</p>
```

Leave the existing "Indisponibil momentan" line (shown when `unavailable`) as-is — that's the entitlement state, unrelated to payment.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, lint adds nothing beyond baseline.

- [ ] **Step 3: Commit**

```bash
git add components/shop/CartDrawer.tsx
git commit -m "feat(cart): note that bonus jars require card payment"
```

---

### Task 5: End-to-end ramburs case

**Files:**
- Modify: `lib/bonus-pack-flow.test.ts`

- [ ] **Step 1: Write the failing test**

In `lib/bonus-pack-flow.test.ts`, the `toCheckoutLines(items)` helper already builds checkout lines and there's a `catalogOf`. Add a test inside the existing top-level `describe`:

```ts
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
```

Note: `toCheckoutLines` in this file currently calls `orderableBonusKeys(items)` (card default) to decide which lines to include. That's correct here — the client would only send bonus lines when on card; the ramburs assertion above exercises the SERVER guard dropping them even if a tampered payload included them. Keep `toCheckoutLines` as-is.

- [ ] **Step 2: Run it to verify it passes**

Run: `npm test -- bonus-pack-flow`
Expected: PASS (Task 1 already added the gate; this test locks in the end-to-end contract). If it FAILS, Task 1's `enforceBonusEntitlement` gate is wrong — fix there, not here.

- [ ] **Step 3: Full suite + commit**

```bash
npm test && npx tsc --noEmit
git add lib/bonus-pack-flow.test.ts
git commit -m "test(promo): ramburs order excludes bonus jars end-to-end"
```

---

## Done when

- `npm test` passes, `npx tsc --noEmit` clean, `npm run lint` adds nothing to the 27-error baseline.
- Task 3 Step 5 walkthrough passes: ramburs greys bonuses as "doar cu plata card" with the nudge; card restores them; toggling doesn't lose them.
- A ramburs order never carries bonus jars (server guard), verified by Task 5.
