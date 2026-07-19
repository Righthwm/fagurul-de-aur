import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * Web Push to admin phones on new orders. Best-effort like lib/meta-capi.ts:
 * silent no-op when the VAPID env vars are missing and never throws, so a push
 * failure can never break checkout. Subscriptions the push service reports
 * gone (404/410) are deleted on first failed send.
 *
 * Env (Vercel): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT — the
 * public key is also exposed client-side as NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 */
export async function sendNewOrderPush(input: { orderId: string; total: number }): Promise<void> {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "mailto:faguruldeaur@gmail.com";
  if (!publicKey || !privateKey) return;

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const subs = await prisma.pushSubscription.findMany({ where: { user: { role: "ADMIN" } } });
    const payload = JSON.stringify({
      title: "🐝 Comandă nouă",
      body: `${input.orderId} — ${input.total} lei`,
      url: "/admin/comenzi",
    });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription
              .delete({ where: { endpoint: s.endpoint } })
              .catch(() => {});
          } else {
            console.error(`Push send failed (${s.endpoint}):`, status ?? error);
          }
        }
      })
    );
  } catch (error) {
    console.error("Push error:", error);
  }
}
