"use client";

import { useState } from "react";

export interface VisitRow {
  id: string;
  path: string;
  method: string;
  ip: string | null;
  statusCode: number | null;
  createdAt: Date;
}

export function AccessLog({ visits }: { visits: VisitRow[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query
    ? visits.filter(
        (v) =>
          v.path.toLowerCase().includes(query) ||
          v.method.toLowerCase().includes(query) ||
          (v.ip ?? "").toLowerCase().includes(query)
      )
    : visits;

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrează după path, metodă sau IP…"
        className="w-full sm:max-w-sm mb-4 bg-bg-surface border border-gold-400/20 rounded-sm px-3 py-2 text-sm text-text-primary outline-none focus:border-gold-400/60"
      />
      <div className="overflow-x-auto border border-gold-400/10 rounded-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-surface text-text-muted text-xs uppercase tracking-wider">
              <th className="text-left font-medium px-3 py-2">Metodă</th>
              <th className="text-left font-medium px-3 py-2">Path</th>
              <th className="text-left font-medium px-3 py-2">IP</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-left font-medium px-3 py-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-t border-gold-400/8">
                <td className="px-3 py-2 text-text-muted">{v.method}</td>
                <td className="px-3 py-2 text-text-primary font-mono text-xs">{v.path}</td>
                <td className="px-3 py-2 text-text-muted">{v.ip ?? "—"}</td>
                <td className="px-3 py-2 text-gold-300">{v.statusCode ?? "—"}</td>
                <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                  {new Date(v.createdAt).toLocaleString("ro-RO", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                  Niciun rezultat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
