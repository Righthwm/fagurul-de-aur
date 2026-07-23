import { Gift } from "lucide-react";

/**
 * Compact "buy 10, get 1 free" volume-offer callout. Presentational and
 * server-safe (no hooks), so it can sit next to the price on product pages and
 * on the homepage — where the buying decision happens — not only on /miere and
 * in the FAQ. Wording mirrors the /miere hero callout for consistency.
 */
export function VolumeOfferNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-lg border border-gold-400/40 bg-gold-400/10 px-3.5 py-2.5 text-sm leading-snug text-text-primary ${className}`}
    >
      <Gift size={17} className="shrink-0 text-gold-300" aria-hidden="true" />
      <span>
        La fiecare <strong className="text-gold-300">10 borcane</strong> de miere din coș, primești{" "}
        <strong className="text-gold-300">1 borcan GRATIS</strong> la alegere.
      </span>
    </div>
  );
}
