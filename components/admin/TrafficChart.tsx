"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TrafficChart({
  data,
}: {
  data: { date: string; visits: number; uniqueIps: number }[];
}) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,160,23,0.1)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#8a7a5a" }}
            interval={4}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#8a7a5a" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1a140a",
              border: "1px solid rgba(212,160,23,0.3)",
              borderRadius: 4,
              fontSize: 12,
            }}
            labelStyle={{ color: "#d4a017" }}
            cursor={{ fill: "rgba(212,160,23,0.08)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#8a7a5a" }} />
          <Bar dataKey="visits" name="Vizite" fill="#D4A017" radius={[3, 3, 0, 0]} />
          <Bar dataKey="uniqueIps" name="IP unice" fill="#5EAAA8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
