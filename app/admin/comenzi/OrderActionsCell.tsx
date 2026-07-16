"use client";

import { useState, useTransition } from "react";
import { markOrderShipped, confirmOrder, cancelOrder, deleteOrder } from "./actions";

type Mode = "idle" | "ship" | "confirm-order" | "confirm-cancel" | "confirm-delete";
type ActionResult = { ok: true } | { ok: false; error: string };

/** Per-row controls in the orders table: Confirmare (only while the order is new)
 *  and Expediat (with AWB form) + Anulare (shown while the order is neither shipped
 *  nor cancelled); Șterge is always available. Each action asks for inline
 *  confirmation first. */
export function OrderActionsCell({
  orderId,
  status,
  awb,
  courierCity,
}: {
  orderId: string;
  status: string;
  awb: string | null;
  courierCity: string | null;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [city, setCity] = useState("");
  const [awbValue, setAwbValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const shipped = status === "expediat" || !!awb;
  const cancelled = status === "anulata";
  const isNew = status === "noua";

  const goto = (next: Mode) => {
    setError("");
    if (next === "idle") {
      setCity("");
      setAwbValue("");
    }
    setMode(next);
  };

  const run = (action: () => Promise<ActionResult>) => {
    setError("");
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Return to idle so the render falls through to the up-to-date status
      // branch after revalidatePath re-renders the row.
      goto("idle");
    });
  };

  if (mode === "ship") {
    return (
      <div className="flex flex-col gap-1 min-w-[180px]">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Oraș expediere"
          className="px-2 py-1 text-xs rounded-sm bg-bg-surface border border-gold-400/20 text-text-primary"
        />
        <input
          value={awbValue}
          onChange={(e) => setAwbValue(e.target.value)}
          placeholder="AWB"
          className="px-2 py-1 text-xs rounded-sm bg-bg-surface border border-gold-400/20 text-text-primary"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => run(() => markOrderShipped(orderId, city, awbValue))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-gold-400/20 text-gold-300 hover:bg-gold-400/30 disabled:opacity-50"
          >
            {pending ? "Se trimite…" : "Trimite"}
          </button>
          <button
            type="button"
            onClick={() => goto("idle")}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
          >
            Renunță
          </button>
        </div>
        {error && <p className="text-error text-[11px]">{error}</p>}
      </div>
    );
  }

  if (mode === "confirm-order") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Trimit confirmarea către client?</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => run(() => confirmOrder(orderId))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-gold-400/20 text-gold-300 hover:bg-gold-400/30 disabled:opacity-50"
          >
            {pending ? "Se trimite…" : "Da, confirmă"}
          </button>
          <button
            type="button"
            onClick={() => goto("idle")}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
          >
            Nu
          </button>
        </div>
        {error && <p className="text-error text-[11px]">{error}</p>}
      </div>
    );
  }

  if (mode === "confirm-cancel") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Sigur anulezi comanda?</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => run(() => cancelOrder(orderId))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-error/15 text-error hover:bg-error/25 disabled:opacity-50"
          >
            {pending ? "Se anulează…" : "Da, anulează"}
          </button>
          <button
            type="button"
            onClick={() => goto("idle")}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
          >
            Nu
          </button>
        </div>
        {error && <p className="text-error text-[11px]">{error}</p>}
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Ștergi definitiv comanda?</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => run(() => deleteOrder(orderId))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-error/15 text-error hover:bg-error/25 disabled:opacity-50"
          >
            {pending ? "Se șterge…" : "Da, șterge"}
          </button>
          <button
            type="button"
            onClick={() => goto("idle")}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
          >
            Nu
          </button>
        </div>
        {error && <p className="text-error text-[11px]">{error}</p>}
      </div>
    );
  }

  // idle: state-specific ship/cancel content + always-present delete.
  return (
    <div className="flex items-center gap-2">
      {cancelled ? (
        <span className="text-text-muted text-xs">Anulată</span>
      ) : shipped ? (
        <span className="text-text-muted text-xs whitespace-nowrap">
          AWB {awb ?? "—"}
          {courierCity ? ` · ${courierCity}` : ""}
        </span>
      ) : (
        <>
          {isNew && (
            <button
              type="button"
              onClick={() => goto("confirm-order")}
              className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors"
            >
              Confirmare
            </button>
          )}
          <button
            type="button"
            onClick={() => goto("ship")}
            className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors"
          >
            Expediat
          </button>
          <button
            type="button"
            onClick={() => goto("confirm-cancel")}
            className="px-3 py-1 rounded-sm text-xs font-medium bg-error/10 text-error hover:bg-error/20 transition-colors"
          >
            Anulare
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => goto("confirm-delete")}
        className="px-3 py-1 rounded-sm text-xs font-medium text-error/80 hover:bg-error/10 transition-colors"
      >
        Șterge
      </button>
      {error && <p className="text-error text-[11px]">{error}</p>}
    </div>
  );
}
