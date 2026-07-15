import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Lightweight order-status lookup for the /payment/return page to poll while the
 * Netopia IPN (server-to-server) confirms the payment. Returns the payment
 * status only — no secrets. A transient DB error responds "pending" so the
 * client keeps polling instead of showing a hard failure.
 */
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ status: "missing" }, { status: 400 });

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      select: { orderNumber: true, paymentStatus: true, total: true },
    });
    if (!order) return NextResponse.json({ status: "missing" });
    return NextResponse.json({
      status: order.paymentStatus, // "paid" | "pending" | "failed" | "n/a"
      orderNumber: order.orderNumber,
      total: order.total,
    });
  } catch {
    return NextResponse.json({ status: "pending" }, { status: 503 });
  }
}
