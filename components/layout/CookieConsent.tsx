"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";
import { getCookieConsent, setCookieConsent, type CookieConsent as Choice } from "@/lib/cookie-consent";

/**
 * Subtle cookie-consent banner shown once, on the first visit. It slides in at
 * the bottom without blocking the page. Three choices — accept all, essentials
 * only, or reject — are persisted so it never re-prompts. See lib/cookie-consent.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  // Decide on the client only (reads localStorage) to avoid a hydration flash.
  useEffect(() => {
    if (getCookieConsent() === null) {
      const t = setTimeout(() => setVisible(true), 1200); // let the page settle first
      return () => clearTimeout(t);
    }
  }, []);

  const choose = (value: Choice) => {
    setCookieConsent(value);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          role="dialog"
          aria-label="Setări cookie-uri"
          className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto z-[55] w-auto sm:max-w-sm rounded-lg border border-gold-400/30 bg-bg-surface/95 backdrop-blur-md p-5 shadow-2xl motion-reduce:transition-none"
        >
          <div className="flex items-start gap-3">
            <Cookie size={20} className="text-gold-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-heading text-text-primary text-base">Cookie-uri</p>
              <p className="text-text-secondary text-sm mt-1 leading-relaxed">
                Folosim cookie-uri esențiale pentru funcționarea site-ului (coș, cont). Poți accepta
                tot sau doar strictul necesar. Detalii în{" "}
                <Link href="/gdpr#cookies" className="text-gold-300 hover:underline">
                  Politica de Confidențialitate
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => choose("all")} className="btn-primary flex-1 text-sm py-2 min-w-[7rem]">
              Accept toate
            </button>
            <button onClick={() => choose("essential")} className="btn-secondary flex-1 text-sm py-2 min-w-[7rem]">
              Doar esențiale
            </button>
            <button
              onClick={() => choose("rejected")}
              className="w-full text-center text-text-muted text-xs hover:text-text-secondary transition-colors mt-1"
            >
              Respinge
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
