"use client";

import { X } from "lucide-react";
import type { FilterCategory, SortOption } from "@/types";

interface FilterState {
  category: FilterCategory;
  sort: SortOption;
  inStock: boolean;
  featured: boolean;
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  totalCount: number;
}

const categories: { value: FilterCategory; label: string }[] = [
  { value: "toate", label: "Toate produsele" },
  { value: "miere", label: "Miere" },
  { value: "apicole", label: "Produse apicole" },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recomandate", label: "Recomandate" },
  { value: "pret-asc", label: "Preț crescător" },
  { value: "pret-desc", label: "Preț descrescător" },
  { value: "nou", label: "Cele mai noi" },
];

function SidebarContent({ filters, onChange, totalCount }: FilterSidebarProps) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-text-muted text-xs font-body uppercase tracking-widest mb-1">
          {totalCount} produse
        </p>
      </div>

      {/* Category */}
      <div>
        <h3 className="font-body text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
          Categorie
        </h3>
        <ul className="space-y-1.5">
          {categories.map((c) => (
            <li key={c.value}>
              <button
                onClick={() => set("category", c.value)}
                className={`w-full text-left text-sm py-1.5 px-2 rounded-sm transition-colors ${
                  filters.category === c.value
                    ? "text-gold-300 bg-gold-400/8"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                aria-pressed={filters.category === c.value}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Sort */}
      <div>
        <h3 className="font-body text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
          Sortare
        </h3>
        <ul className="space-y-1.5">
          {sortOptions.map((s) => (
            <li key={s.value}>
              <button
                onClick={() => set("sort", s.value)}
                className={`w-full text-left text-sm py-1.5 px-2 rounded-sm transition-colors ${
                  filters.sort === s.value
                    ? "text-gold-300 bg-gold-400/8"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                aria-pressed={filters.sort === s.value}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Toggles */}
      <div>
        <h3 className="font-body text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
          Filtre
        </h3>
        <div className="space-y-3">
          {[
            { key: "inStock", label: "Disponibil" },
            { key: "featured", label: "Recomandate" },
          ].map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-3 cursor-pointer group"
              htmlFor={`filter-${key}`}
            >
              <input
                id={`filter-${key}`}
                type="checkbox"
                checked={filters[key as "inStock" | "featured"]}
                onChange={(e) =>
                  set(key as "inStock" | "featured", e.target.checked)
                }
                className="sr-only"
              />
              <span
                className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-colors ${
                  filters[key as "inStock" | "featured"]
                    ? "bg-gold-400 border-gold-400"
                    : "border-gold-400/30 group-hover:border-gold-400/60"
                }`}
                aria-hidden="true"
              >
                {filters[key as "inStock" | "featured"] && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L4 7L9 1" stroke="#0D0A06" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm text-text-muted group-hover:text-text-secondary transition-colors">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FilterSidebar(props: FilterSidebarProps) {
  const { isMobileOpen, onMobileClose } = props;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block w-56 shrink-0"
        aria-label="Filtre produse"
      >
        <div className="sticky top-24">
          <SidebarContent {...props} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 bg-bg-surface border-r border-gold-400/20 p-6 overflow-y-auto lg:hidden"
            aria-label="Filtre produse — mobil"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-heading text-lg text-text-primary">Filtre</span>
              <button
                onClick={onMobileClose}
                className="p-1.5 text-text-muted hover:text-gold-300 transition-colors"
                aria-label="Închide filtre"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent {...props} />
          </aside>
        </>
      )}
    </>
  );
}
