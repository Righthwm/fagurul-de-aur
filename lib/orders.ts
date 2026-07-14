import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { estimateShipping, cartSubtotal } from "@/lib/shipping";
import { couponDiscount, getCoupon } from "@/lib/coupons";
import { localityTypeOf } from "@/lib/localities";
import { enforceBonusEntitlement } from "@/lib/promo";
import { products } from "@/lib/products";

/** Shared validation for both the ramburs checkout and card payment-initiate routes. */
export const checkoutInputSchema = z.object({
  customer: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(9),
  }),
  shippingAddress: z.object({
    county: z.string().min(1),
    city: z.string().min(1),
    address: z.string().min(5),
    postalCode: z.string().regex(/^\d{6}$/),
  }),
  paymentMethod: z.enum(["card", "ramburs"]),
  notes: z.string().optional(),
  couponCode: z.string().max(40).optional(),
  items: z
    .array(
      z
        .object({
          productId: z.string(),
          name: z.string(),
          variant: z.string().optional(),
          unitPrice: z.number().int().nonnegative(),
          quantity: z.number().int().positive(),
          isBonus: z.boolean().optional(),
          bonusSource: z.enum(["kg", "pack"]).optional(),
        })
        // Only free bonus jars may be priced at 0; paid lines must cost > 0.
        .refine((i) => i.isBonus === true || i.unitPrice > 0, {
          message: "unitPrice must be positive for non-bonus items",
        })
    )
    .min(1),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/** How many times a coupon has already been redeemed (orders that used it). */
export async function couponUsageCount(code: string): Promise<number> {
  return prisma.order.count({ where: { couponCode: code } });
}

export interface PersistedOrder {
  orderId: string;
  totals: { subtotal: number; shipping: number; discount: number; total: number };
  notes: string | null;
  /** Items actually ordered — after the free-jar entitlement guard. */
  items: CheckoutInput["items"];
}

/**
 * Recompute shipping authoritatively, then persist the order (linked to the
 * logged-in account if any). `paymentStatus` is "n/a" for ramburs and "pending"
 * for card until the IPN confirms it.
 */
export async function persistOrder(input: CheckoutInput, paymentStatus: string): Promise<PersistedOrder> {
  const orderId = `SB-${Date.now().toString(36).toUpperCase()}`;
  const session = await auth();

  // Re-derive the free-jar entitlement from paid honey, dropping any bonus jars
  // beyond it so a tampered payload can't smuggle in free items.
  const catalogOf = (id: string) => products.find((p) => p.id === id);
  const orderedItems = enforceBonusEntitlement(input.items, catalogOf);

  const lines = orderedItems.map((i) => ({
    productId: i.productId,
    variantPrice: i.unitPrice,
    quantity: i.quantity,
  }));
  const subtotal = cartSubtotal(lines);
  const shippingResult = await estimateShipping({
    items: lines,
    county: input.shippingAddress.county,
    locality: input.shippingAddress.city,
    localityType: localityTypeOf(input.shippingAddress.county, input.shippingAddress.city),
    cashOnDelivery: input.paymentMethod === "ramburs" ? subtotal : 0,
  });
  const shipping = shippingResult.cost;
  // Coupon validated + applied server-side so the total can't be tampered with.
  const coupon = getCoupon(input.couponCode); // null if missing/expired
  let appliedCode: string | null = coupon?.code ?? null;
  let discount = couponDiscount(subtotal, input.couponCode);
  // Enforce a usage limit by counting prior redemptions.
  if (coupon?.maxUses != null && (await couponUsageCount(coupon.code)) >= coupon.maxUses) {
    appliedCode = null;
    discount = 0;
  }
  const total = Math.max(0, subtotal - discount + shipping);

  const notes = input.notes?.trim() || null;

  await prisma.order.create({
    data: {
      orderNumber: orderId,
      userId: session?.user?.id ?? null,
      customerFirstName: input.customer.firstName,
      customerLastName: input.customer.lastName,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      shippingCounty: input.shippingAddress.county,
      shippingCity: input.shippingAddress.city,
      shippingAddress: input.shippingAddress.address,
      shippingPostalCode: input.shippingAddress.postalCode,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      notes,
      items: JSON.stringify(orderedItems),
      subtotal,
      shipping,
      couponCode: appliedCode,
      discount,
      total,
    },
  });

  return { orderId, totals: { subtotal, shipping, discount, total }, notes, items: orderedItems };
}
