"use client";

import { HoneyJar } from "./HoneyJar";
import type { Product } from "@/types";

interface ProductVisualProps {
  product: Product;
  width?: number;
  className?: string;
}

/** Product illustration — the honey jar, tinted per product. */
export function ProductVisual({ product, width = 110, className }: ProductVisualProps) {
  return <HoneyJar color={product.color} width={width} className={className} />;
}
