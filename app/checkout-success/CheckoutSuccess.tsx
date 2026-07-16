"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { trackPurchase } from "@/lib/analytics";

/**
 * Success screen for the post-purchase page. Fires the Purchase conversion
 * (de-duplicated per order, so a refresh never double-counts) and clears the
 * cart on mount — this page is only ever reached once an order has succeeded.
 */
export function CheckoutSuccess({
  orderId,
  total,
  payment,
}: {
  orderId: string | null;
  total: number | null;
  payment: "card" | "ramburs";
}) {
  const clearCart = useCartStore((s) => s.clearCart);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !orderId) return;
    done.current = true;
    if (total != null) trackPurchase(orderId, total);
    clearCart();
  }, [orderId, total, clearCart]);

  // Reached without an order id (e.g. someone opened the URL directly) — thank
  // them but show no order details and fire nothing.
  if (!orderId) {
    return (
      <>
        <CheckCircle size={56} className="text-success mx-auto mb-5" />
        <h1 className="font-heading text-3xl text-text-primary mb-3" style={{ fontSize: "2rem" }}>
          Mulțumim!
        </h1>
        <p className="text-text-secondary mb-6">Comanda ta a fost înregistrată.</p>
        <Link href="/miere" className="btn-primary">
          Înapoi la magazin
        </Link>
      </>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <CheckCircle size={56} className="text-success mx-auto mb-5" />
      <h1 className="font-heading text-3xl text-text-primary mb-3" style={{ fontSize: "2rem" }}>
        {payment === "card" ? "Plată reușită!" : "Comanda a fost plasată!"}
      </h1>
      <p className="text-text-secondary mb-6">
        Mulțumim! Vei primi un email de confirmare în câteva minute.
      </p>
      <div className="bg-bg-elevated border border-gold-400/15 rounded-sm p-5 text-left space-y-2 mb-8">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Număr comandă</span>
          <span className="text-gold-300 font-semibold font-body">{orderId}</span>
        </div>
        {total != null && (
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Total</span>
            <span className="text-text-primary font-semibold">{formatPrice(total)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Plată</span>
          <span className="text-text-primary">
            {payment === "card" ? "Card bancar (plătită)" : "Ramburs la livrare"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Livrare estimată</span>
          <span className="text-text-primary">24–48h lucrătoare</span>
        </div>
      </div>
      <Link href="/miere" className="btn-primary">
        Înapoi la magazin
      </Link>
    </motion.div>
  );
}
