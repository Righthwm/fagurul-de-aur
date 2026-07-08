import { describe, it, expect } from "vitest";
import {
  variantHoneyKg,
  paidHoneyKg,
  earnedFreeJars,
  claimedFreeJars,
  overclaimedFreeJars,
  unclaimedFreeJars,
} from "./promo";
import { products } from "./products";
import type { CartItem, ProductVariant } from "@/types";

const honey = (id: string) => products.find((p) => p.id === id)!;
const jar1kg: ProductVariant = { weight: "1kg", price: 30, weightKg: 1.4 };
const pack5kg: ProductVariant = { type: "Pachet 5 borcane (5kg)", price: 200, weightKg: 7 };

function line(id: string, variant: ProductVariant = jar1kg, quantity = 1, isBonus = false): CartItem {
  return { product: honey(id), quantity, selectedVariant: variant, isBonus };
}

describe("variantHoneyKg", () => {
  it("parses kg from the weight label", () => {
    expect(variantHoneyKg(jar1kg)).toBe(1);
  });
  it("parses kg from a pack type label", () => {
    expect(variantHoneyKg(pack5kg)).toBe(5);
  });
  it("is 0 for non-kg units like propolis 20ml", () => {
    expect(variantHoneyKg({ weight: "20ml", price: 15, weightKg: 0.2 })).toBe(0);
  });
});

describe("paidHoneyKg", () => {
  it("sums honey kg × quantity", () => {
    expect(paidHoneyKg([line("miere-tei", jar1kg, 4)])).toBe(4);
  });
  it("counts a 5kg pack as 5kg", () => {
    expect(paidHoneyKg([line("miere-salcam", pack5kg, 2)])).toBe(10);
  });
  it("excludes propolis", () => {
    const propolis = {
      product: honey("miere-tei") && products.find((p) => p.id === "tinctura-propolis")!,
      quantity: 3,
      selectedVariant: { weight: "20ml", price: 15, weightKg: 0.2 },
    };
    expect(paidHoneyKg([line("miere-tei", jar1kg, 6), propolis])).toBe(6);
  });
  it("excludes bonus jars", () => {
    expect(paidHoneyKg([line("miere-tei", jar1kg, 10), line("miere-munte", jar1kg, 1, true)])).toBe(10);
  });
});

describe("earned / claimed / overclaimed / unclaimed", () => {
  it("earns one jar per 10kg, rounding down", () => {
    expect(earnedFreeJars([line("miere-tei", jar1kg, 9)])).toBe(0);
    expect(earnedFreeJars([line("miere-tei", jar1kg, 10)])).toBe(1);
    expect(earnedFreeJars([line("miere-tei", jar1kg, 25)])).toBe(2);
  });

  it("tracks a freshly earned but unclaimed jar", () => {
    const cart = [line("miere-tei", jar1kg, 10)];
    expect(unclaimedFreeJars(cart)).toBe(1);
    expect(claimedFreeJars(cart)).toBe(0);
    expect(overclaimedFreeJars(cart)).toBe(0);
  });

  it("is settled once the bonus jar is added", () => {
    const cart = [line("miere-tei", jar1kg, 10), line("miere-munte", jar1kg, 1, true)];
    expect(unclaimedFreeJars(cart)).toBe(0);
    expect(claimedFreeJars(cart)).toBe(1);
    expect(overclaimedFreeJars(cart)).toBe(0);
  });

  it("flags an overclaimed jar when paid honey drops below the threshold", () => {
    const cart = [line("miere-tei", jar1kg, 8), line("miere-munte", jar1kg, 1, true)];
    expect(earnedFreeJars(cart)).toBe(0);
    expect(overclaimedFreeJars(cart)).toBe(1);
  });
});
