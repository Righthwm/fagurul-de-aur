import { describe, it, expect } from "vitest";
import { couponFreeShipping } from "@/lib/coupons";

describe("couponFreeShipping", () => {
  it("is false for coupons without the flag", () => {
    expect(couponFreeShipping("FAGURE5")).toBe(false);
  });

  it("is false for an unknown or missing code", () => {
    expect(couponFreeShipping("NOPE")).toBe(false);
    expect(couponFreeShipping(null)).toBe(false);
  });
});
