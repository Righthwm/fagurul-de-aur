"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendShippingEmail, sendCancellationEmail } from "@/lib/email";

const shipInput = z.object({
  courierCity: z.string().trim().min(2),
  awb: z.string().trim().min(3),
});

/**
 * Mark an order dispatched: validate, email the customer, then (only if the email
 * succeeded) persist status + AWB. ADMIN-only, mirroring app/admin/clienti/actions.ts.
 * Returns a result object for the UI; throws only on an auth violation.
 */
export async function markOrderShipped(
  orderId: string,
  courierCity: string,
  awb: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = shipInput.safeParse({ courierCity, awb });
  if (!parsed.success) {
    return { ok: false, error: "Completează orașul de expediere și AWB-ul." };
  }

  const order = await prisma.order.findUnique({ where: { orderNumber: orderId } });
  if (!order) {
    return { ok: false, error: "Comanda nu a fost găsită." };
  }

  // All-or-nothing: send the email first; if it fails, leave the order untouched.
  try {
    await sendShippingEmail({
      orderId: order.orderNumber,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
      courierCity: parsed.data.courierCity,
      awb: parsed.data.awb,
    });
  } catch {
    return { ok: false, error: "Emailul nu a putut fi trimis. Încearcă din nou." };
  }

  await prisma.order.update({
    where: { orderNumber: orderId },
    data: { awb: parsed.data.awb, courierCity: parsed.data.courierCity, status: "expediat" },
  });
  revalidatePath("/admin/comenzi");
  return { ok: true };
}

/**
 * Cancel an order: email the customer, then (only if the email succeeded) set the
 * status to "anulata". ADMIN-only. Refuses orders already shipped or cancelled.
 */
export async function cancelOrder(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({ where: { orderNumber: orderId } });
  if (!order) {
    return { ok: false, error: "Comanda nu a fost găsită." };
  }
  if (order.status === "expediat" || order.status === "anulata") {
    return { ok: false, error: "Comanda nu mai poate fi anulată." };
  }

  // All-or-nothing: send the email first; if it fails, leave the order untouched.
  try {
    await sendCancellationEmail({
      orderId: order.orderNumber,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
    });
  } catch {
    return { ok: false, error: "Emailul nu a putut fi trimis. Încearcă din nou." };
  }

  await prisma.order.update({
    where: { orderNumber: orderId },
    data: { status: "anulata" },
  });
  revalidatePath("/admin/comenzi");
  return { ok: true };
}

/**
 * Permanently delete an order. ADMIN-only, no email. Orders have no child rows
 * (items are JSON; the User relation is onDelete: SetNull), so one delete suffices.
 * Prisma throws P2025 if the row is missing — caught and surfaced as an error.
 */
export async function deleteOrder(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  try {
    await prisma.order.delete({ where: { orderNumber: orderId } });
  } catch {
    return { ok: false, error: "Comanda nu a putut fi ștearsă." };
  }
  revalidatePath("/admin/comenzi");
  return { ok: true };
}
