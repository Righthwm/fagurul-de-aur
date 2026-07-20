import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPwa } from "@/components/admin/AdminPwa";
import { PushToggle } from "@/components/admin/PushToggle";
import { BottomNav } from "@/components/admin/BottomNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const links = [
    { href: "/admin", label: "Trafic" },
    { href: "/admin/comenzi", label: "Comenzi" },
    { href: "/admin/mesaje", label: "Mesaje" },
    { href: "/admin/clienti", label: "Clienți" },
  ];

  return (
    // Extra bottom padding on phones so content clears the fixed tab bar.
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 md:pb-20">
      <AdminPwa />
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Desktop sidebar — unchanged look, plus the notifications toggle. */}
        <aside className="hidden md:block md:w-48 shrink-0">
          <span className="font-heading text-xl text-gold-300 block mb-4">Panou admin</span>
          <nav className="flex md:flex-col gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded-sm text-text-secondary hover:text-gold-300 hover:bg-gold-400/5 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6">
            <PushToggle />
          </div>
        </aside>

        {/* Phone header: title + toggle (navigation lives in the bottom bar). */}
        <div className="md:hidden flex items-center justify-between gap-2">
          <span className="font-heading text-xl text-gold-300">Panou admin</span>
          <PushToggle />
        </div>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
