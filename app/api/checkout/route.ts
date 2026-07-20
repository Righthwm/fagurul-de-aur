import { NextResponse } from "next/server";
import { z } from "zod";
import { sendOrderEmail } from "@/lib/email";
import { checkoutInputSchema, persistOrder } from "@/lib/orders";
import { sendCapiPurchase, requestClientData } from "@/lib/meta-capi";
import { sendNewOrderPush } from "@/lib/push";

/** Ramburs orders: persist immediately and notify the shop. Card payments go
 *  through /api/payment/initiate instead. */
export async function POST(request: Request) {
  try {
    const input = checkoutInputSchema.parse(await request.json());
    // Ramburs endpoint: never a card payment, so bonuses are always dropped here.
    const { orderId, totals, notes, items } = await persistOrder(input, "n/a", false);

    try {
      await sendOrderEmail({
        orderId,
        customer: input.customer,
        shippingAddress: input.shippingAddress,
        paymentMethod: input.paymentMethod,
        notes: notes ?? undefined,
        couponCode: input.couponCode,
        items,
        totals,
      });
    } catch (mailError) {
      console.error("Failed to send order notification email:", mailError);
    }

    // Server-side Purchase to Meta (deduped with the browser Pixel via orderId).
    // The customer's own request carries their IP/UA/_fbp for better matching.
    await sendCapiPurchase({
      orderId,
      value: totals.total,
      email: input.customer.email,
      phone: input.customer.phone,
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      city: input.shippingAddress.city,
      county: input.shippingAddress.county,
      postalCode: input.shippingAddress.postalCode,
      sourceUrl: "https://faguruldeaur.ro/checkout-success",
      ...requestClientData(request),
    });

    // Push notification to admin phones (best-effort, like the CAPI call).
    await sendNewOrderPush({ orderId, total: totals.total });

    return NextResponse.json({ success: true, orderId, totals }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    console.error("Checkout error:", error);
    return NextResponse.json({ success: false, message: "Eroare internă de server." }, { status: 500 });
  }
}
