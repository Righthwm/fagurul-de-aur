import { describe, it, expect } from "vitest";
import { products } from "./products";
import { honeyJarCount } from "./shipping";
import { variantHoneyKg } from "./promo";

/** Gross shipping weight (kg) of a single 1kg jar, incl. jar + packaging. */
const GROSS_KG_PER_JAR = 1.4;

describe("catalog invariants", () => {
  it("never puts a pack first: variants[0] is always a single jar", () => {
    for (const product of products) {
      expect(
        product.variants[0]?.bonusPack ?? false,
        `${product.id}: variants[0] is a bonusPack — the one-click add path would default to it`
      ).toBe(false);
    }
  });

  it("keeps every pack's label, jar count and shipping weight in agreement", () => {
    const packs = products.flatMap((product) =>
      product.variants.filter((v) => v.bonusPack).map((variant) => ({ product, variant }))
    );
    expect(packs.length).toBeGreaterThan(0); // guard against a vacuous pass

    for (const { product, variant } of packs) {
      const label = variant.weight ?? variant.type ?? "";
      // Jar count as shipping actually resolves it, via the real cart-line path.
      const jars = honeyJarCount([
        { productId: product.id, variantPrice: variant.price, quantity: 1 },
      ]);

      expect(jars, `${product.id} "${label}": jar count must match the kg in the label`).toBe(
        variantHoneyKg(variant)
      );
      expect(
        variant.weightKg,
        `${product.id} "${label}": weightKg must be ${jars} jars × ${GROSS_KG_PER_JAR}kg`
      ).toBeCloseTo(jars * GROSS_KG_PER_JAR);
    }
  });
});
