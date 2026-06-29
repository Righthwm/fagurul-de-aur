import { Droplet, Truck, ShieldCheck, Hexagon, Users } from "lucide-react";

const items = [
  { icon: Droplet, label: "100% Miere pură" },
  { icon: Truck, label: "Livrare 24–48h" },
  { icon: ShieldCheck, label: "Garanție: banii înapoi" },
  { icon: Hexagon, label: "Direct de la stupină" },
  { icon: Users, label: "Peste 400 clienți fideli" },
];

/** Thin reassurance band under the hero — kills first-purchase friction. */
export function TrustBar() {
  return (
    <section
      className="border-y border-gold-400/10 bg-bg-secondary"
      aria-label="Motive de încredere"
    >
      <ul className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center justify-center gap-2.5 text-center">
            <Icon size={20} className="text-gold-400 shrink-0" aria-hidden="true" />
            <span className="text-text-secondary text-sm font-medium">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
