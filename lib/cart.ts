"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, ProductVariant } from "@/types";
import { products } from "@/lib/products";
import {
  variantHoneyKg,
  earnedFreeJars,
  claimedFreeJars,
  unclaimedFreeJars,
  overclaimedFreeJars,
} from "@/lib/promo";

// Re-exported from the framework-neutral constants module (this file is
// "use client"; server code must read the threshold from lib/constants).
export { SHIPPING_COST, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

import { SHIPPING_COST as FLAT, FREE_SHIPPING_THRESHOLD as THRESHOLD } from "@/lib/constants";

/** Shipping fee for a given subtotal — 0 when it qualifies for free shipping. */
export function shippingFor(subtotal: number): number {
  return subtotal >= THRESHOLD ? 0 : FLAT;
}

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

    // Bonus jars are always a free 1kg jar — keep them at price 0 after refresh
    // so a catalog price change can never turn a free jar into a paid one.
    if (item.isBonus) {
      return [{ ...item, product, selectedVariant: { ...variant, price: 0 } }];
    }

    return [{ ...item, product, selectedVariant: variant }];
  });
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  /** Whether the "choose your free jar" popup is showing. */
  bonusChooserOpen: boolean;
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  addBonusItem: (product: Product) => void;
  removeBonusItem: (bonusKey: number) => void;
  openBonusChooser: () => void;
  closeBonusChooser: () => void;
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
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      bonusChooserOpen: false,

      addItem: (product, variant, quantity = 1) => {
        set((state) => {
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

      // Add a free 1kg jar of the chosen honey (price 0). Each earned jar is its
      // own line so availability ("indisponibil momentan") is tracked per line.
      addBonusItem: (product) => {
        const base =
          product.variants.find((v) => variantHoneyKg(v) === 1) ?? product.variants[0];
        const bonusVariant: ProductVariant = { ...base, price: 0 };
        set((state) => ({
          items: [
            ...state.items,
            {
              product,
              quantity: 1,
              selectedVariant: bonusVariant,
              isBonus: true,
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
