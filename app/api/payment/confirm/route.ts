import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIpn } from "@/lib/netopia";
import { sendOrderEmail, type OrderItem } from "@/lib/email";
import { sendCapiPurchase } from "@/lib/meta-capi";

/**
 * Netopia IPN (server-to-server). The order is marked paid/failed ONLY here,
 * after the signature is verified — never on the browser redirect, which can be
 * forged. Responds { errorCode: 0 } so Netopia stops retrying.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const token =
      request.headers.get("Verification-token") ?? request.headers.get("verification-token");
    const ipn = verifyIpn(raw, token);

    // Diagnostic (no secrets): surfaces WHY verification passed/failed in the
    // Vercel logs — token shape, chosen alg, or the exact rejection reason.
    console.log(
      `Netopia IPN: order=${ipn.orderId || "?"} status=${ipn.status} verified=${ipn.verified} ` +
        `tokenPresent=${token != null} reason="${ipn.verifyDebug}"`
    );

    if (!ipn.verified) {
      return NextResponse.json({ errorCode: 1, message: "invalid signature" }, { status: 400 });
    }
    if (!ipn.orderId) {
      return NextResponse.json({ errorCode: 1, message: "missing order id" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { orderNumber: ipn.orderId } });
    if (!order) {
      return NextResponse.json({ errorCode: 1, message: "order not found" }, { status: 404 });
    }

    if (ipn.status === "paid" && order.paymentStatus !== "paid") {
      await prisma.order.update({
        where: { orderNumber: ipn.orderId },
        data: { paymentStatus: "paid", paymentId: ipn.ntpID || order.paymentId },
      });
      try {
        await sendOrderEmail({
          orderId: order.orderNumber,
          customer: {
            firstName: order.customerFirstName,
            lastName: order.customerLastName,
            email: order.customerEmail,
            phone: order.customerPhone,
          },
          shippingAddress: {
            county: order.shippingCounty,
            city: order.shippingCity,
            address: order.shippingAddress,
            postalCode: order.shippingPostalCode,
          },
          paymentMethod: order.paymentMethod === "card" ? "card" : "ramburs",
          notes: order.notes ?? undefined,
          couponCode: order.couponCode,
          items: JSON.parse(order.items) as OrderItem[],
          totals: {
            subtotal: order.subtotal,
            shipping: order.shipping,
            discount: order.discount,
            total: order.total,
          },
        });
      } catch (mailError) {
        console.error("Failed to send paid-order email:", mailError);
      }

      // Server-side Purchase to Meta, fired once on the paid transition and
      // deduped with the browser Pixel via orderId. This is Netopia's IPN
      // request, so there's no customer IP/UA/_fbp — email/phone/name/address
      // hashing carries the match instead.
      await sendCapiPurchase({
        orderId: order.orderNumber,
        value: order.total,
        email: order.customerEmail,
        phone: order.customerPhone,
        firstName: order.customerFirstName,
        lastName: order.customerLastName,
        city: order.shippingCity,
        county: order.shippingCounty,
        postalCode: order.shippingPostalCode,
        sourceUrl: "https://faguruldeaur.ro/checkout-success",
      });
    } else if (ipn.status === "failed" && order.paymentStatus === "pending") {
      await prisma.order.update({
        where: { orderNumber: ipn.orderId },
        data: { paymentStatus: "failed" },
      });
    }

    return NextResponse.json({ errorCode: 0 });
  } catch (error) {
    console.error("Netopia IPN error:", error);
    return NextResponse.json({ errorCode: 1 }, { status: 500 });
  }
}
