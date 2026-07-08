"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { products } from "@/lib/products";
import { isHoney, unclaimedFreeJars } from "@/lib/promo";
import { ProductVisual } from "@/components/ui/ProductVisual";

// Only honey jars can be claimed as the free jar (propolis is excluded).
const honeyProducts = products.filter(isHoney);

/**
 * Celebratory "you earned a free jar" popup. Auto-opens whenever the cart earns
 * a new (unclaimed) free jar, lets the customer pick which honey they want, and
 * adds it to the cart at no cost. Mounted once, globally, beside the CartDrawer.
 */
export function FreeJarPopup() {
  const items = useCartStore((s) => s.items);
  const bonusChooserOpen = useCartStore((s) => s.bonusChooserOpen);
  const openBonusChooser = useCartStore((s) => s.openBonusChooser);
  const closeBonusChooser = useCartStore((s) => s.closeBonusChooser);
  const addBonusItem = useCartStore((s) => s.addBonusItem);
  const openCart = useCartStore((s) => s.openCart);

  const unclaimed = unclaimedFreeJars(items);
  const [index, setIndex] = useState(0);
  const prevUnclaimed = useRef(0);

  // Auto-open when a new free jar is earned; auto-close once none are pending.
  useEffect(() => {
    if (unclaimed > prevUnclaimed.current) openBonusChooser();
    if (unclaimed === 0) closeBonusChooser();
    prevUnclaimed.current = unclaimed;
  }, [unclaimed, openBonusChooser, closeBonusChooser]);

  const visible = bonusChooserOpen && unclaimed > 0;
  const product = honeyProducts[index];

  const prev = () => setIndex((i) => (i - 1 + honeyProducts.length) % honeyProducts.length);
  const next = () => setIndex((i) => (i + 1) % honeyProducts.length);

  const claim = () => {
    addBonusItem(product);
    openCart();
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            onClick={closeBonusChooser}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Alege borcanul gratuit"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.35 }}
            className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gold-400/30 bg-bg-surface p-7 text-center shadow-2xl"
          >
            <button
              onClick={closeBonusChooser}
              className="absolute right-3 top-3 p-1.5 text-text-muted hover:text-gold-300 transition-colors"
              aria-label="Închide"
            >
              <X size={18} />
            </button>

            {/* Celebration header */}
            <div className="flex items-center justify-center gap-2 text-gold-300 mb-2">
              <Sparkles size={16} />
              <Gift size={22} />
              <Sparkles size={16} />
            </div>
            <h2 className="font-heading text-2xl text-text-primary">
              Felicitări! Ați câștigat un borcan gratuit
            </h2>
            <p className="text-text-secondary text-sm mt-2 mb-6">
              Alegeți ce miere doriți{unclaimed > 1 ? ` (${unclaimed} borcane de ales)` : ""}.
            </p>

            {/* Jar carousel */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 shrink-0 rounded-full border border-gold-400/20 flex items-center justify-center text-text-muted hover:text-gold-300 hover:border-gold-400/50 transition-colors"
                aria-label="Mierea anterioară"
              >
                <ChevronLeft size={20} />
              </button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center gap-3 w-52"
                >
                  <div className="h-40 flex items-end justify-center">
                    <ProductVisual product={product} width={110} />
                  </div>
                  <p className="font-heading text-lg text-text-primary">{product.name}</p>
                </motion.div>
              </AnimatePresence>

              <button
                onClick={next}
                className="w-10 h-10 shrink-0 rounded-full border border-gold-400/20 flex items-center justify-center text-text-muted hover:text-gold-300 hover:border-gold-400/50 transition-colors"
                aria-label="Mierea următoare"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-1.5 mt-4 mb-6" aria-hidden="true">
              {honeyProducts.map((p, i) => (
                <span
                  key={p.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-4 bg-gold-400" : "w-1.5 bg-text-muted/50"
                  }`}
                />
              ))}
            </div>

            <button onClick={claim} className="btn-primary w-full gap-2">
              <Gift size={16} />
              Adaugă gratuit în coș
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
