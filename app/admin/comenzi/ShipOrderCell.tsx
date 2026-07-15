"use client";

import { useState, useTransition } from "react";
import { markOrderShipped } from "./actions";

/** Per-row control in the orders table: shows the "Expediat" button, reveals an
 *  inline city + AWB form, and calls the server action. Already-shipped orders
 *  render the saved AWB read-only so you can't dispatch twice by accident. */
export function ShipOrderCell({
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
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [awbValue, setAwbValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (status === "expediat" || awb) {
    return (
      <span className="text-text-muted text-xs whitespace-nowrap">
        AWB {awb ?? "—"}
        {courierCity ? ` · ${courierCity}` : ""}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors"
      >
        Expediat
      </button>
    );
  }

  const submit = () => {
    setError("");
    startTransition(async () => {
      const res = await markOrderShipped(orderId, city, awbValue);
      if (!res.ok) setError(res.error);
      // On success revalidatePath re-renders the table into the read-only state.
    });
  };

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
          onClick={submit}
          disabled={pending}
          className="px-2 py-1 rounded-sm text-xs font-medium bg-gold-400/20 text-gold-300 hover:bg-gold-400/30 disabled:opacity-50"
        >
          {pending ? "Se trimite…" : "Trimite"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
        >
          Anulează
        </button>
      </div>
      {error && <p className="text-error text-[11px]">{error}</p>}
    </div>
  );
}
