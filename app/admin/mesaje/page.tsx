import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Admin · Mesaje" };
export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-text-primary">Mesaje ({messages.length})</h1>

      {messages.length === 0 ? (
        <p className="text-text-muted text-sm">Niciun mesaj încă.</p>
      ) : (
        <ul className="space-y-4">
          {messages.map((m) => (
            <Card key={m.id}>
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <p className="text-text-primary font-medium">{m.name}</p>
                  <p className="text-text-muted text-xs">
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </p>
                </div>
                <p className="text-text-muted text-xs whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <p className="text-gold-300 text-xs uppercase tracking-wider mb-2">{m.subject}</p>
              <p className="text-text-secondary text-sm whitespace-pre-wrap">{m.message}</p>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
