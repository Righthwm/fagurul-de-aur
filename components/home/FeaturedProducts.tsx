"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBasket, Star } from "lucide-react";
import { getFeaturedProducts } from "@/lib/products";
import { useCartStore } from "@/lib/cart";
import { Badge } from "@/components/ui/Badge";
import { ProductVisual } from "@/components/ui/ProductVisual";
import { formatPrice } from "@/lib/utils";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import type { Product } from "@/types";

function ProductFeaturedCard({ product }: { product: Product }) {
  const { addItem, openCart } = useCartStore();
  const firstVariant = product.variants[0];

  const handleAdd = () => {
    addItem(product, firstVariant);
    openCart();
  };

  return (
    <motion.article
      className="card group relative flex flex-col overflow-hidden"
      whileHover={{ y: -8 }}
      transition={{ duration: 0.2 }}
      aria-label={product.name}
    >
      <div className="relative p-8 flex flex-col items-center">
        {product.badge && (
          <div className="absolute top-4 left-4">
            <Badge color={product.badgeColor ?? "gold"}>{product.badge}</Badge>
          </div>
        )}

        {/* Jar with gentle float */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ProductVisual product={product} width={118} />
        </motion.div>
      </div>

      <div className="px-6 pb-4 flex flex-col gap-2 flex-1">
        <p className="text-text-muted text-xs uppercase tracking-wider font-body">
          {product.subcategory ?? product.category}
        </p>
        <h3 className="font-heading text-text-primary">{product.name}</h3>
        <p className="text-text-muted text-sm leading-relaxed line-clamp-2">{product.description}</p>

        <div className="flex items-center gap-1 mt-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={12}
              className={i < Math.floor(product.rating) ? "text-gold-300 fill-current" : "text-text-muted"}
            />
          ))}
          <span className="text-text-muted text-xs ml-1">({product.reviewCount})</span>
        </div>

        <div className="flex items-baseline justify-between mt-2">
          <span className="font-heading text-gold-300 text-2xl">
            {formatPrice(product.price)}
          </span>
          <span className="text-text-muted text-xs">/ {product.priceUnit}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 pt-2 flex items-center gap-3">
        <Link
          href={`/magazin/${product.slug}`}
          className="btn-secondary flex-1 px-3 text-sm whitespace-nowrap"
        >
          Vezi detalii
        </Link>
        <button onClick={handleAdd} className="btn-primary flex-1 px-3 text-sm whitespace-nowrap">
          <ShoppingBasket size={16} className="shrink-0" />
          Adaugă în coș
        </button>
      </div>
    </motion.article>
  );
}

export function FeaturedProducts() {
  const featured = getFeaturedProducts();
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>();

  return (
    <section
      id="produse-recomandate"
      className="relative py-24 px-4 sm:px-6 lg:px-8 bg-bg-primary"
      aria-label="Produse recomandate"
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          ref={ref}
          variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="gold-line" />
          <h2 className="section-heading font-heading">Mierea Noastră de Excepție</h2>
          <p className="section-subheading">
            Selecția noastră de produse artizanale, recoltate manual, cu grijă pentru fiecare detaliu.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {featured.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.12 }}
            >
              <ProductFeaturedCard product={product} />
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/magazin" className="btn-secondary">
            Vezi toate produsele
          </Link>
        </div>
      </div>
    </section>
  );
}
