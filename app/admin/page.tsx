import type { Metadata } from "next";
import { getTrafficStats, getRecentVisits } from "@/lib/traffic";
import { TrafficChart } from "@/components/admin/TrafficChart";
import { AccessLog } from "@/components/admin/AccessLog";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Admin · Trafic" };

// Always render fresh traffic numbers.
export const dynamic = "force-dynamic";

export default async function AdminTrafficPage() {
  const [stats, visits] = await Promise.all([getTrafficStats(), getRecentVisits(100)]);

  const cards = [
    { label: "Vizite azi", value: stats.today },
    { label: "Ultima săptămână", value: stats.week },
    { label: "Luna curentă", value: stats.month },
    { label: "IP-uri unice", value: stats.uniqueIps },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl text-text-primary">Trafic</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <p className="text-text-muted text-sm">{c.label}</p>
            <p className="font-heading text-3xl text-gold-300 mt-1">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-heading text-lg text-text-primary mb-4">Vizite — ultimele 30 de zile</h2>
        <TrafficChart data={stats.daily} />
      </Card>

      <div>
        <h2 className="font-heading text-lg text-text-primary mb-4">Jurnal de acces (ultimele 100)</h2>
        <AccessLog visits={visits} />
      </div>
    </div>
  );
}
