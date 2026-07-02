"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Star, ShoppingBasket, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProductVisual } from "@/components/ui/ProductVisual";
import { useCartStore } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, openCart } = useCartStore();
  const firstVariant = product.variants[0];
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    addItem(product, firstVariant, quantity);
    setQuantity(1);
    openCart();
  };

  return (
    <article className="card group flex flex-col overflow-hidden relative" aria-label={product.name}>
      {/* Badge */}
      {product.badge && (
        <div className="absolute top-3 left-3 z-10">
          <Badge color={product.badgeColor ?? "gold"}>{product.badge}</Badge>
        </div>
      )}

      {/* Offer badge (opposite corner) */}
      {product.offerBadge && (
        <div className="absolute top-3 right-3 z-10">
          <Badge color="amber">{product.offerBadge}</Badge>
        </div>
      )}

      <Link href={`/miere/${product.slug}`} className="flex flex-col items-center pt-10 pb-4 px-6">
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <ProductVisual product={product} width={92} />
        </motion.div>
      </Link>

      <div className="px-5 pb-2 flex-1">
        <h3 className="font-heading text-lg text-text-primary">{product.name}</h3>
        <p className="text-text-muted text-xs mt-0.5 uppercase tracking-wider font-body">
          {product.subcategory
            ? `${product.subcategory.charAt(0).toUpperCase() + product.subcategory.slice(1)} · ${product.category}`
            : product.category}
        </p>

        <div className="flex items-center gap-1 mt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={11}
              className={i < Math.floor(product.rating) ? "text-gold-300 fill-current" : "text-bg-elevated"}
            />
          ))}
          <span className="text-text-muted text-xs ml-1">{product.reviewCount}</span>
        </div>

        <div className="flex items-baseline gap-1.5 mt-3">
          <span className="font-heading text-gold-300 text-2xl">{formatPrice(product.price)}</span>
          <span className="text-text-muted text-xs">/ {product.priceUnit}</span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 flex gap-2">
        <div className="flex items-center border border-gold-400/20 rounded-sm shrink-0">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-8 h-10 flex items-center justify-center text-text-muted hover:text-gold-300 transition-colors"
            aria-label="Scade cantitate"
          >
            <Minus size={13} />
          </button>
          <span className="w-7 text-center text-sm text-text-primary font-body" aria-live="polite">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-8 h-10 flex items-center justify-center text-text-muted hover:text-gold-300 transition-colors"
            aria-label="Crește cantitate"
          >
            <Plus size={13} />
          </button>
        </div>
        <button
          onClick={handleAdd}
          className="btn-primary flex-1 text-sm gap-2"
          aria-label={`Adaugă ${quantity} × ${product.name} în coș`}
        >
          <ShoppingBasket size={15} />
          Adaugă
        </button>
      </div>
    </article>
  );
}
