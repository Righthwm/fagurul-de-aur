import { describe, it, expect } from "vitest";
import { couponDiscount, couponFreeShipping, getCoupon } from "@/lib/coupons";

describe("TESTPLATA99 coupon", () => {
  it("is case-insensitive and takes 99% off the subtotal", () => {
    expect(getCoupon("testplata99")?.code).toBe("TESTPLATA99");
    expect(couponDiscount(300, "testplata99")).toBe(297); // rest de plată: 3 lei
  });

  it("grants free shipping", () => {
    expect(couponFreeShipping("testplata99")).toBe(true);
  });
});

describe("couponFreeShipping", () => {
  it("is false for coupons without the flag", () => {
    expect(couponFreeShipping("FAGURE5")).toBe(false);
  });

  it("is false for an unknown or missing code", () => {
    expect(couponFreeShipping("NOPE")).toBe(false);
    expect(couponFreeShipping(null)).toBe(false);
  });
});
