"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";

type View = "checking" | "paid" | "failed" | "pending" | "missing";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30; // ~60s — the IPN normally lands within a few seconds.

/**
 * Polls the order status after a card payment. The Netopia IPN confirms the
 * order server-to-server, which can land a moment AFTER the browser returns —
 * so we keep checking rather than declaring failure on the first pending read.
 * Only an explicit "failed" status shows the retry screen.
 */
export function PaymentReturnStatus({ orderId }: { orderId: string | null }) {
  const [view, setView] = useState<View>(orderId ? "checking" : "missing");
  const [total, setTotal] = useState<number | null>(null);
  const clearCart = useCartStore((s) => s.clearCart);
  const cleared = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`/api/payment/status?orderId=${encodeURIComponent(orderId!)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { status?: string; total?: number };
        if (!active) return;
        if (typeof data.total === "number") setTotal(data.total);

        if (data.status === "paid") return setView("paid");
        if (data.status === "failed") return setView("failed");
        // pending / missing / n/a → keep polling until we run out of attempts.
        if (attempts >= MAX_ATTEMPTS) {
          return setView(data.status === "missing" ? "missing" : "pending");
        }
      } catch {
        if (!active) return;
        if (attempts >= MAX_ATTEMPTS) return setView("pending");
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      active = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (view === "paid" && !cleared.current) {
      cleared.current = true;
      clearCart();
    }
  }, [view, clearCart]);

  if (view === "paid") {
    return (
      <>
        <CheckCircle size={56} className="text-success mx-auto mb-5" />
        <h1 className="font-heading text-3xl text-text-primary mb-3" style={{ fontSize: "2rem" }}>
          Plată reușită!
        </h1>
        <p className="text-text-secondary mb-6">
          Mulțumim! Comanda <strong className="text-gold-300">{orderId}</strong> a fost plătită
          {total != null ? ` (${formatPrice(total)})` : ""}. Vei primi un email de confirmare.
        </p>
        <Link href="/miere" className="btn-primary">
          Înapoi la magazin
        </Link>
      </>
    );
  }

  if (view === "failed") {
    return (
      <>
        <AlertCircle size={56} className="text-error mx-auto mb-5" />
        <h1 className="font-heading text-3xl text-text-primary mb-3" style={{ fontSize: "2rem" }}>
          Plata nu a reușit
        </h1>
        <p className="text-text-secondary mb-6">Plata a fost anulată sau respinsă. Poți reîncerca.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/checkout" className="btn-primary">
            Reîncearcă plata
          </Link>
          <Link href="/miere" className="btn-secondary">
            Magazin
          </Link>
        </div>
      </>
    );
  }

  // "checking" and "pending" both reassure — the payment may still be confirming.
  if (view === "checking" || view === "pending") {
    return (
      <>
        <Clock size={56} className="text-gold-400 mx-auto mb-5 animate-pulse" />
        <h1 className="font-heading text-3xl text-text-primary mb-3" style={{ fontSize: "2rem" }}>
          Se procesează plata
        </h1>
        <p className="text-text-secondary mb-6">
          Confirmăm plata pentru comanda <strong className="text-gold-300">{orderId}</strong>. Te rugăm
          nu închide pagina — se actualizează automat.
          {view === "pending" && (
            <>
              <br />
              Dacă plata a fost reținută, vei primi confirmarea pe email; o poți vedea și în contul tău,
              la comenzi.
            </>
          )}
        </p>
        <Link href="/dashboard" className="btn-secondary">
          Comenzile mele
        </Link>
      </>
    );
  }

  // "missing" — no order matched the id (rare); reassure rather than alarm.
  return (
    <>
      <AlertCircle size={56} className="text-gold-400 mx-auto mb-5" />
      <h1 className="font-heading text-3xl text-text-primary mb-3" style={{ fontSize: "2rem" }}>
        Verificăm comanda
      </h1>
      <p className="text-text-secondary mb-6">
        Nu am găsit încă detaliile comenzii. Dacă plata a fost reținută, o confirmăm prin email — poți
        verifica și în contul tău.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/dashboard" className="btn-primary">
          Comenzile mele
        </Link>
        <Link href="/miere" className="btn-secondary">
          Magazin
        </Link>
      </div>
    </>
  );
}
