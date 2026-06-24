import { prisma } from "@/lib/prisma";

export interface TrafficStats {
  today: number;
  week: number;
  month: number;
  uniqueIps: number;
  /** Visit counts per day for the last 30 days, oldest first. */
  daily: { date: string; visits: number }[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return startOfDay(d).toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
}

export async function getTrafficStats(): Promise<TrafficStats> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6); // last 7 days incl. today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const chartStart = new Date(todayStart);
  chartStart.setDate(chartStart.getDate() - 29); // last 30 days

  const [today, week, month, chartVisits, distinctIps] = await Promise.all([
    prisma.pageVisit.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.pageVisit.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.pageVisit.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.pageVisit.findMany({
      where: { createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.pageVisit.findMany({
      where: { ip: { not: null } },
      select: { ip: true },
      distinct: ["ip"],
    }),
  ]);

  // Pre-seed 30 day buckets so the chart has no gaps.
  const buckets = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    buckets.set(dayKey(d), 0);
  }
  for (const v of chartVisits) {
    const key = dayKey(new Date(v.createdAt));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return {
    today,
    week,
    month,
    uniqueIps: distinctIps.length,
    daily: [...buckets.entries()].map(([date, visits]) => ({ date, visits })),
  };
}

export async function getRecentVisits(limit = 100) {
  return prisma.pageVisit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      path: true,
      method: true,
      ip: true,
      statusCode: true,
      createdAt: true,
    },
  });
}
