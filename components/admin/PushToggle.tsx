"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { savePushSubscription, removePushSubscription } from "@/app/admin/push-actions";

type State = "unsupported" | "blocked" | "off" | "on" | "busy";

/** Converts a base64url VAPID public key into the Uint8Array subscribe() wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Enable/disable new-order push notifications for this device. Hidden when
 *  the browser can't do web push or the VAPID key isn't configured. */
export function PushToggle() {
  const [state, setState] = useState<State>("busy");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    (async () => {
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return setState("unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      // serviceWorker.ready never rejects; race a timeout so the button can't
      // stay "busy" forever if registration never completes.
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (!reg) return setState("unsupported");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  const enable = async () => {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") return setState("blocked");
      if (permission !== "granted") return setState("off"); // dismissed — allow retry
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // TS 5.7+ narrows BufferSource to ArrayBufferView<ArrayBuffer>; a freshly
        // constructed Uint8Array is always backed by ArrayBuffer, so this is safe.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const res = await savePushSubscription(sub.toJSON());
      if (!res.ok) {
        // Server has no row — drop the browser subscription too so the next
        // mount doesn't report "on" for a subscription nothing will push to.
        await sub.unsubscribe().catch(() => {});
        return setState("off");
      }
      setState("on");
    } catch {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        await sub?.unsubscribe();
      } catch {
        /* leave as is */
      }
      setState("off");
    }
  };

  const disable = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  };

  if (state === "unsupported") return null;
  if (state === "blocked") {
    return (
      <p className="text-xs text-text-muted">Notificările sunt blocate din setările telefonului.</p>
    );
  }
  const on = state === "on";
  return (
    <button
      type="button"
      onClick={on ? disable : enable}
      disabled={state === "busy"}
      className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors disabled:opacity-50"
    >
      {on ? <BellOff size={14} /> : <Bell size={14} />}
      {state === "busy" ? "Se procesează…" : on ? "Dezactivează notificările" : "Activează notificările"}
    </button>
  );
}
