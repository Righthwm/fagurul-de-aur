"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Plus, Minus, Trash2, ShoppingBasket, Gift } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart";
import { orderableBonusKeys, unclaimedFreeJars, unclaimedPackBonuses } from "@/lib/promo";
import { formatPrice } from "@/lib/utils";

export function CartDrawer() {
  const {
    isOpen,
    closeCart,
    items,
    removeItem,
    removeBonusItem,
    updateQuantity,
    totalPrice,
    totalItems,
    openBonusChooser,
  } = useCartStore();

  const subtotal = totalPrice();
  // Delivery is 30 lei to a city / 50 lei to a village — but the locality isn't
  // known until checkout, so the drawer shows the range and totals products only.
  const total = subtotal;
  const count = totalItems();
  const router = useRouter();

  // Split paid lines from earned free jars. Bonus lines outside their pool's
  // entitlement are shown as "indisponibil momentan" (cart dropped below the
  // qualifying kg, or the pack/trigger jar was removed).
  const paidItems = items.filter((i) => !i.isBonus);
  const bonusItems = items.filter((i) => i.isBonus);
  const orderableKeys = orderableBonusKeys(items);
  const unclaimed = unclaimedFreeJars(items) + unclaimedPackBonuses(items);

  // Navigate programmatically: the drawer unmounts on closeCart(), which would
  // otherwise abort a plain <Link> click before the route change commits.
  const navigate = (href: string) => {
    router.push(href);
    closeCart();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={closeCart}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.35, ease: "easeInOut" }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-bg-surface border-l border-gold-400/20 flex flex-col"
            aria-label="Coș de cumpărături"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gold-400/10">
              <div className="flex items-center gap-2">
                <ShoppingBasket size={20} className="text-gold-400" />
                <span className="font-heading text-lg text-text-primary">
                  Coș ({count})
                </span>
              </div>
              <button
                onClick={closeCart}
                className="p-1.5 text-text-muted hover:text-gold-300 transition-colors"
                aria-label="Închide coș"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <ShoppingBasket size={48} className="text-text-muted opacity-30" />
                  <p className="text-text-muted text-sm">Coșul tău este gol</p>
                  <button onClick={() => navigate("/miere")} className="btn-secondary text-xs px-6 py-2">
                    Descoperă Produsele
                  </button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {paidItems.map((item) => {
                    const variantLabel =
                      item.selectedVariant.weight ?? item.selectedVariant.type ?? "";
                    return (
                      <li
                        key={`${item.product.id}-${item.selectedVariant.price}`}
                        className="flex gap-4 py-3 border-b border-gold-400/8"
                      >
                        {/* Product photo (color swatch fallback) */}
                        <div
                          className="relative w-14 h-14 rounded-sm shrink-0 overflow-hidden border border-gold-400/10 flex items-center justify-center"
                          style={{
                            background: `radial-gradient(circle at 35% 30%, ${item.product.color}33, ${item.product.color}11)`,
                          }}
                        >
                          {item.product.image ? (
                            <Image
                              src={item.product.image}
                              alt={item.product.name}
                              fill
                              sizes="56px"
                              className="object-contain p-0.5 drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
                            />
                          ) : (
                            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                              <ellipse cx="14" cy="14" rx="11" ry="10" fill={item.product.color} opacity="0.9" />
                              <ellipse cx="10" cy="10" rx="3" ry="2.5" fill="rgba(255,255,255,0.3)" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary text-sm font-medium truncate">
                            {item.product.name}
                          </p>
                          <p className="text-text-muted text-xs mt-0.5">{variantLabel}</p>

                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.selectedVariant.price,
                                  item.quantity - 1
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center border border-gold-400/20 text-text-muted hover:text-gold-300 hover:border-gold-400/50 transition-colors rounded-sm"
                              aria-label="Scade cantitate"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-sm text-text-primary w-5 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.selectedVariant.price,
                                  item.quantity + 1
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center border border-gold-400/20 text-text-muted hover:text-gold-300 hover:border-gold-400/50 transition-colors rounded-sm"
                              aria-label="Crește cantitate"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between shrink-0">
                          <button
                            onClick={() =>
                              removeItem(item.product.id, item.selectedVariant.price)
                            }
                            className="text-text-muted hover:text-error transition-colors"
                            aria-label={`Elimină ${item.product.name} din coș`}
                          >
                            <Trash2 size={14} />
                          </button>
                          <span className="text-gold-300 font-body text-sm font-semibold">
                            {formatPrice(item.selectedVariant.price * item.quantity)}
                          </span>
                        </div>
                      </li>
                    );
                  })}

                  {/* Free jars earned through the promotion */}
                  {bonusItems.map((item) => {
                    const unavailable = item.bonusKey == null || !orderableKeys.has(item.bonusKey);
                    return (
                      <li
                        key={item.bonusKey}
                        className="flex gap-4 py-3 border-b border-gold-400/8"
                      >
                        <div
                          className={`relative w-14 h-14 rounded-sm shrink-0 overflow-hidden border flex items-center justify-center ${
                            unavailable ? "border-gold-400/10 opacity-50" : "border-gold-400/40"
                          }`}
                          style={{
                            background: `radial-gradient(circle at 35% 30%, ${item.product.color}33, ${item.product.color}11)`,
                          }}
                        >
                          {item.product.image ? (
                            <Image
                              src={item.product.image}
                              alt={item.product.name}
                              fill
                              sizes="56px"
                              className="object-contain p-0.5 drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
                            />
                          ) : (
                            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                              <ellipse cx="14" cy="14" rx="11" ry="10" fill={item.product.color} opacity="0.9" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary text-sm font-medium truncate flex items-center gap-1.5">
                            <Gift size={13} className="text-gold-400 shrink-0" />
                            {item.product.name}
                          </p>
                          <p className="text-text-muted text-xs mt-0.5">
                            {item.selectedVariant.weight ?? item.selectedVariant.type} · borcan bonus
                          </p>
                          <p className="text-gold-300/80 text-[11px] mt-0.5">Gratuite la plata cu cardul</p>
                          {unavailable && (
                            <p className="text-amber-300 text-xs mt-1">Indisponibil momentan</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end justify-between shrink-0">
                          <button
                            onClick={() => item.bonusKey != null && removeBonusItem(item.bonusKey)}
                            className="text-text-muted hover:text-error transition-colors"
                            aria-label={`Elimină borcanul bonus ${item.product.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                          <span
                            className={`font-body text-sm font-semibold uppercase tracking-wide ${
                              unavailable ? "text-text-muted line-through" : "text-success"
                            }`}
                          >
                            Gratuit
                          </span>
                        </div>
                      </li>
                    );
                  })}

                  {/* Reclaim prompt for an earned-but-unchosen free jar */}
                  {unclaimed > 0 && (
                    <li>
                      <button
                        onClick={openBonusChooser}
                        className="w-full flex items-center justify-center gap-2 rounded-sm border border-dashed border-gold-400/50 bg-gold-400/5 px-4 py-3 text-sm text-gold-300 hover:bg-gold-400/10 transition-colors"
                      >
                        <Gift size={15} />
                        {unclaimed > 1
                          ? `Alege cele ${unclaimed} borcane gratuite`
                          : "Alege borcanul gratuit"}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-6 py-5 border-t border-gold-400/10 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted font-body">Subtotal</span>
                    <span className="text-text-secondary">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-text-muted font-body shrink-0">Transport</span>
                    <span className="text-text-secondary text-xs text-right">
                      Se calculează la finalizarea comenzii
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-gold-400/10 pt-3">
                  <span className="text-text-secondary font-body text-sm">Total</span>
                  <span className="font-heading text-xl text-gold-300">{formatPrice(total)}</span>
                </div>
                <button
                  onClick={() => navigate("/checkout")}
                  className="btn-primary w-full text-center block"
                >
                  Finalizează Comanda
                </button>
                <button
                  onClick={closeCart}
                  className="w-full text-center text-text-muted text-xs hover:text-text-secondary transition-colors"
                >
                  Continuă cumpărăturile
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
