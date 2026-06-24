"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { FilterSidebar } from "./FilterSidebar";
import { products } from "@/lib/products";
import type { FilterCategory, SortOption, Product } from "@/types";

interface FilterState {
  category: FilterCategory;
  sort: SortOption;
  inStock: boolean;
  featured: boolean;
}

const defaultFilters: FilterState = {
  category: "toate",
  sort: "recomandate",
  inStock: false,
  featured: false,
};

function applyFilters(items: Product[], filters: FilterState): Product[] {
  let result = [...items];

  if (filters.category !== "toate") {
    result = result.filter((p) => p.category === filters.category);
  }
  if (filters.inStock) {
    result = result.filter((p) => p.inStock);
  }
  if (filters.featured) {
    result = result.filter((p) => p.featured);
  }

  switch (filters.sort) {
    case "pret-asc":
      result.sort((a, b) => a.price - b.price);
      break;
    case "pret-desc":
      result.sort((a, b) => b.price - a.price);
      break;
    case "nou":
      result.reverse();
      break;
    default:
      break;
  }

  return result;
}

export function ProductGrid() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => applyFilters(products, filters), [filters]);

  return (
    <div className="flex gap-10">
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        isMobileOpen={mobileFiltersOpen}
        onMobileClose={() => setMobileFiltersOpen(false)}
        totalCount={filtered.length}
      />

      <div className="flex-1 min-w-0">
        {/* Mobile filter toggle */}
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <span className="text-text-muted text-sm">{filtered.length} produse</span>
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-gold-300 transition-colors border border-gold-400/20 px-3 py-2 rounded-sm"
            aria-label="Deschide filtre"
          >
            <SlidersHorizontal size={15} />
            Filtre
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <p className="text-text-muted text-lg font-heading">Niciun produs găsit</p>
            <button
              onClick={() => setFilters(defaultFilters)}
              className="text-gold-300 text-sm hover:text-gold-400 transition-colors"
            >
              Resetează filtrele
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
