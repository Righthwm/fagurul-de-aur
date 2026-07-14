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
        <span className="font-heading text-2xl text-gold-300">{packVariant.price} lei</span>
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
