"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/** Seasonal scarcity band — authentic urgency (limited summer harvest). */
export function SeasonBanner() {
  const [open, setOpen] = useState(true);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4 }}
          aria-label="Anunț recoltă de sezon"
          style={{ background: "linear-gradient(135deg, #241E14 0%, #3A2E18 100%)" }}
          className="relative border-y border-gold-400/20 overflow-hidden"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-2 text-center">
            <p className="text-text-secondary text-sm sm:text-base">
              <span aria-hidden="true">🐝 </span>
              <strong className="text-gold-300">Recolta de salcâm 2026 a ieșit din stupină</strong>{" "}
              — în cantitate limitată. Anul trecut s-a terminat în 3 săptămâni.
            </p>
            <Link href="/miere" className="btn-primary text-xs whitespace-nowrap shrink-0">
              Comandă recolta nouă
            </Link>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Închide anunțul"
            className="absolute top-2 right-3 p-1 text-text-muted hover:text-gold-300 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
