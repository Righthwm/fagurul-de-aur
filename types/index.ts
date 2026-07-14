export interface ProductVariant {
  weight?: string;
  type?: string;
  price: number;
  /** Shipping weight in kg (gross, incl. jar + packaging). Used for courier tariff. */
  weightKg?: number;
  /** Multi-jar pack granting its own bonus jar, separate from the per-kg promotion. */
  bonusPack?: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: "miere" | "apicole";
  subcategory?: string;
  description: string;
  longDescription: string;
  price: number;
  priceUnit: string;
  variants: ProductVariant[];
  color: string;
  /** Icon shape used for the product illustration. Defaults to the honey jar. */
  visual?: "jar" | "bottle";
  /** Real product photo (transparent PNG/WebP). Overrides the generated illustration. */
  image?: string;
  badge?: string;
  badgeColor?: "gold" | "green" | "amber";
  /** Optional promo badge shown in the opposite corner (e.g. a bundle offer). */
  offerBadge?: string;
  inStock: boolean;
  tags: string[];
  benefits: string[];
  origin: string;
  harvest: string;
  rating: number;
  reviewCount: number;
  featured?: boolean;
}

export interface Review {
  id: string;
  author: string;
  city: string;
  rating: number;
  text: string;
  date: string;
}

/** Which promotion granted a free line: the per-kg promo or a bonus pack. */
export type BonusSource = "kg" | "pack";

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant: ProductVariant;
  /** A free line earned through a promotion (price 0). */
  isBonus?: boolean;
  /** Which promotion granted it. Absent on paid items, and absent on bonus lines
   *  persisted before pack bonuses existed — treat those as "kg". */
  bonusSource?: BonusSource;
  /** Unique id for a bonus line (bonus jars all share price 0, so they need
   *  their own identity for removal). Absent on paid items. */
  bonusKey?: number;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  initials: string;
}

export interface TimelineEvent {
  year: string;
  title: string;
  description: string;
}

export interface Testimonial {
  id: string;
  author: string;
  city: string;
  rating: number;
  text: string;
}

export type FilterCategory = "toate" | "miere" | "apicole";
export type SortOption = "recomandate" | "pret-asc" | "pret-desc" | "nou";
