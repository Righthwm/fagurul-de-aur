"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendShippingEmail } from "@/lib/email";

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
