"use client";

import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ShoppingBasket } from "lucide-react";
import { useCartStore } from "@/lib/cart";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const navLinks = [
  { href: "/", label: "Acasă" },
  { href: "/magazin", label: "Magazin" },
  { href: "/despre-noi", label: "Despre Noi" },
  { href: "/contact", label: "Contact" },
];

const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -16,
    transition: {
      duration: 0.2,
      ease: "easeIn",
      when: "afterChildren",
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: -10, transition: { duration: 0.15, ease: "easeIn" } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { totalItems, openCart } = useCartStore();
  const count = totalItems();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 top-16 z-20 bg-black/25 backdrop-blur-[2px] lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.nav
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed top-16 inset-x-0 z-20 lg:hidden bg-bg-surface/70 backdrop-blur-xl border-b border-gold-400/15 rounded-b-2xl shadow-2xl shadow-black/15 overflow-y-auto max-h-[calc(100dvh-4rem)]"
            aria-label="Meniu mobil"
          >
            <ul className="flex flex-col px-6 pt-3 pb-2">
              {navLinks.map((link) => (
                <motion.li key={link.href} variants={itemVariants}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="block py-3 px-2 font-heading text-xl font-light text-text-primary hover:text-gold-300 transition-colors border-b border-gold-400/8"
                  >
                    {link.label}
                  </Link>
                </motion.li>
              ))}
            </ul>

            <motion.div variants={itemVariants} className="px-6 pt-3 pb-6">
              <button
                onClick={() => {
                  onClose();
                  openCart();
                }}
                className="btn-secondary w-full flex items-center justify-center gap-3"
              >
                <ShoppingBasket size={18} />
                Coș de cumpărături
                {count > 0 && (
                  <span className="bg-gold-400 text-bg-primary text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {count}
                  </span>
                )}
              </button>
            </motion.div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
