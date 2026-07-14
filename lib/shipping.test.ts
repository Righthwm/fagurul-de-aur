import { describe, it, expect } from "vitest";
import { packageWeightKg, cartSubtotal, estimateShipping } from "./shipping";
import { baseRateForWeight, provisionalTariff, SHIPPING_CONFIG } from "./shipping-config";
import { localityTypeOf } from "./localities";

// miere-salcam 1kg = 45 lei / 1.4 kg ; propolis 20ml = 15 lei / 0.2 kg
const salcam = { productId: "miere-salcam", variantPrice: 45, quantity: 2 };
const propolis = { productId: "tinctura-propolis", variantPrice: 15, quantity: 1 };

describe("packageWeightKg", () => {
  it("sums variant weights × quantity", () => {
    expect(packageWeightKg([salcam])).toBe(2.8); // 1.4 × 2
    expect(packageWeightKg([salcam, propolis])).toBe(3.0); // 2.8 + 0.2
  });

  it("falls back to a default weight for unknown products", () => {
    expect(packageWeightKg([{ productId: "nope", variantPrice: 1, quantity: 3 }])).toBe(3);
  });
});

describe("cartSubtotal", () => {
  it("sums price × quantity", () => {
    expect(cartSubtotal([salcam, propolis])).toBe(105); // 45×2 + 15
  });
});

describe("estimateShipping", () => {
  const urban = { county: "Cluj", locality: "Cluj-Napoca", localityType: "urban" as const, cashOnDelivery: 0 };
  const rural = { county: "Gorj", locality: "Sterpoaia", localityType: "rural" as const, cashOnDelivery: 0 };

  it("adds 5 lei per honey jar on top of the flat 30 lei urban fee", async () => {
    const result = await estimateShipping({ items: [salcam], ...urban }); // 2 × 1kg jars
    expect(result.cost).toBe(40); // 30 + 2×5
  });

  it("adds the surcharge on top of the 50 lei rural fee; propolis is not a honey jar", async () => {
    const result = await estimateShipping({ items: [salcam, propolis], ...rural }); // 2 honey jars
    expect(result.cost).toBe(60); // 50 + 2×5
    expect(result.weightKg).toBe(3.0);
  });

  it("charges only 3 lei per honey jar beyond the 10-jar (10 kg) threshold", async () => {
    const many = [{ productId: "miere-salcam", variantPrice: 45, quantity: 12 }]; // 12 × 1kg jars
    const result = await estimateShipping({ items: many, ...urban });
    expect(result.cost).toBe(86); // 30 + (10×5 + 2×3)
  });
});

describe("provisional shipping config", () => {
  it("prices each weight bracket", () => {
    expect(baseRateForWeight(0.8)).toBe(18); // ≤1 kg
    expect(baseRateForWeight(1.4)).toBe(20); // ≤2 kg
    expect(baseRateForWeight(3)).toBe(22); // ≤3 kg
    expect(baseRateForWeight(4.5)).toBe(25); // ≤5 kg
    expect(baseRateForWeight(9)).toBe(32); // ≤10 kg
    expect(baseRateForWeight(20)).toBe(48); // ≤20 kg
  });

  it("adds an overage fee above the top bracket", () => {
    expect(baseRateForWeight(23)).toBe(48 + 3 * 2); // 3 kg over 20 → +6 lei
  });

  it("applies a flat national rate, with a fixed surcharge only for rural", () => {
    const fee = SHIPPING_CONFIG.ruralSurchargeLei;
    expect(provisionalTariff(3, "urban")).toBe(22); // same price anywhere in the country
    expect(provisionalTariff(3, "rural")).toBe(22 + fee);
    expect(provisionalTariff(0.8, "rural")).toBe(18 + fee);
  });

  it("dispatches from the Petroșani agency", () => {
    expect(SHIPPING_CONFIG.ORIGIN.locality).toBe("Petroșani");
    expect(SHIPPING_CONFIG.ORIGIN.county).toBe("Hunedoara");
  });
});

describe("localityTypeOf (auto urban/rural detection)", () => {
  it("classifies cities as urban", () => {
    expect(localityTypeOf("Hunedoara", "Petroșani")).toBe("urban");
    expect(localityTypeOf("Gorj", "Târgu Jiu")).toBe("urban");
    expect(localityTypeOf("Cluj", "Cluj-Napoca")).toBe("urban");
    expect(localityTypeOf("București", "Sector 1")).toBe("urban");
  });

  it("classifies villages as rural", () => {
    expect(localityTypeOf("Gorj", "Sterpoaia")).toBe("rural");
    expect(localityTypeOf("Gorj", "Albeni")).toBe("rural");
  });

  it("defaults unknown localities to rural", () => {
    expect(localityTypeOf("Gorj", "Sat Inexistent")).toBe("rural");
  });
});
