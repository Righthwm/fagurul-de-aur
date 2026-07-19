"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PushSubscription.toJSON() shape; zod strips extra fields (expirationTime).
const subscriptionInput = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Save (upsert by endpoint) this device's push subscription. ADMIN-only. */
export async function savePushSubscription(
  subscription: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = subscriptionInput.safeParse(subscription);
  if (!parsed.success) {
    return { ok: false, error: "Abonament invalid." };
  }

  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id },
  });
  return { ok: true };
}

/** Remove this device's subscription (notifications off). ADMIN-only. */
export async function removePushSubscription(
  endpoint: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  // Runtime guard: server actions are public POST endpoints, so the TS type is
  // not enforced. An undefined endpoint would drop the filter and delete every row.
  if (typeof endpoint !== "string" || !endpoint) {
    return { ok: false, error: "Abonament invalid." };
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
}
