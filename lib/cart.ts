"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BonusSource, CartItem, Product, ProductVariant } from "@/types";
import { products } from "@/lib/products";
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

// Re-exported from the framework-neutral constants module (this file is
// "use client"; server code must read shipping constants from lib/constants).
export { SHIPPING_URBAN, SHIPPING_RURAL } from "@/lib/constants";

/**
 * Reconcile a persisted cart against the current catalog so it always reflects
 * what the sales pages show (e.g. honey jars at 1kg). Persisted items hold a
 * frozen snapshot of the product/variant from the moment they were added, which
 * goes stale when product data changes — this refreshes that snapshot.
 */
function reconcileItems(items: CartItem[]): CartItem[] {
  return items.flatMap((item) => {
    const product = products.find((p) => p.id === item.product.id);
    if (!product) return []; // product no longer exists — drop it

    const saved = item.selectedVariant;
    const variant =
      product.variants.find(
        (v) =>
          (saved.weight != null && v.weight === saved.weight) ||
          (saved.type != null && v.type === saved.type)
      ) ?? product.variants[0];

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

    return [{ ...item, product, selectedVariant: variant }];
  });
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
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
  removeItem: (productId: string, variantPrice: number) => void;
  updateQuantity: (productId: string, variantPrice: number, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
  /** Free jars the paid honey qualifies for (1 per 10kg). */
  earnedFreeJars: () => number;
  /** Free jars already in the cart. */
  claimedFreeJars: () => number;
  /** A newly earned free jar is waiting to be chosen. */
  unclaimedFreeJars: () => number;
  /** Free jars claimed beyond what the cart now qualifies for (shown as
   *  "indisponibil momentan" and dropped at checkout). */
  overclaimedFreeJars: () => number;
  /** Pack bonuses the cart qualifies for (1 per pack, once a trigger jar exists). */
  earnedPackBonuses: () => number;
  /** Pack bonuses already in the cart. */
  claimedPackBonuses: () => number;
  /** A pack bonus is waiting to be chosen. */
  unclaimedPackBonuses: () => number;
  /** Pack bonuses claimed beyond the entitlement. */
  overclaimedPackBonuses: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      bonusChooserOpen: false,
      packOfferOpen: false,

      addItem: (product, variant, quantity = 1) => {
        set((state) => {
          // Paid adds only. Bonus lines must never merge through this path — each
          // gets its own line via addBonusItem — because pack-bonus accounting
          // counts lines, not units, and every bonus line shares price 0.
          const existing = state.items.find(
            (i) => i.product.id === product.id && i.selectedVariant.price === variant.price
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id && i.selectedVariant.price === variant.price
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return {
            items: [...state.items, { product, quantity, selectedVariant: variant }],
          };
        });
      },

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

      removeBonusItem: (bonusKey) => {
        set((state) => ({ items: state.items.filter((i) => i.bonusKey !== bonusKey) }));
      },

      openBonusChooser: () => set({ bonusChooserOpen: true }),
      closeBonusChooser: () => set({ bonusChooserOpen: false }),
      openPackOffer: () => set({ packOfferOpen: true }),
      closePackOffer: () => set({ packOfferOpen: false }),

      removeItem: (productId, variantPrice) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.product.id === productId && i.selectedVariant.price === variantPrice)
          ),
        }));
      },

      updateQuantity: (productId, variantPrice, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantPrice);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId && i.selectedVariant.price === variantPrice
              ? { ...i, quantity }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.selectedVariant.price * i.quantity, 0),

      earnedFreeJars: () => earnedFreeJars(get().items),
      claimedFreeJars: () => claimedFreeJars(get().items),
      unclaimedFreeJars: () => unclaimedFreeJars(get().items),
      overclaimedFreeJars: () => overclaimedFreeJars(get().items),
      earnedPackBonuses: () => earnedPackBonuses(get().items),
      claimedPackBonuses: () => claimedPackBonuses(get().items),
      unclaimedPackBonuses: () => unclaimedPackBonuses(get().items),
      overclaimedPackBonuses: () => overclaimedPackBonuses(get().items),
    }),
    {
      name: "fagurul-de-aur-cart",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) state.items = reconcileItems(state.items);
      },
    }
  )
);
