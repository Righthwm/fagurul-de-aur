"use client";

import { HoneyJar } from "./HoneyJar";
import { TinctureBottle } from "./TinctureBottle";
import type { Product } from "@/types";

interface ProductVisualProps {
  product: Product;
  width?: number;
  className?: string;
}

/** Product illustration — honey jar by default, dropper bottle for tinctures. */
export function ProductVisual({ product, width = 110, className }: ProductVisualProps) {
  if (product.visual === "bottle") {
    return <TinctureBottle color={product.color} width={width} className={className} />;
  }
  return <HoneyJar color={product.color} width={width} className={className} />;
}
