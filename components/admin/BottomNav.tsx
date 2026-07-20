"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Package, Mail, Users } from "lucide-react";

const tabs = [
  { href: "/admin", label: "Trafic", icon: BarChart3 },
  { href: "/admin/comenzi", label: "Comenzi", icon: Package },
  { href: "/admin/mesaje", label: "Mesaje", icon: Mail },
  { href: "/admin/clienti", label: "Clienți", icon: Users },
];

/** Fixed bottom tab bar for the admin on phones; hidden on md+ screens. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-surface/95 backdrop-blur border-t border-gold-400/15 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] min-h-[44px] transition-colors ${
              active ? "text-gold-300" : "text-text-muted hover:text-gold-300"
            }`}
          >
            <t.icon size={18} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
