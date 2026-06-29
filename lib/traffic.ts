import { prisma } from "@/lib/prisma";

export interface TrafficStats {
  today: number;
  week: number;
  month: number;
  uniqueIps: number;
  /** Session (view) counts per day for the last 30 days, oldest first. */
  daily: { date: string; visits: number }[];
}

/**
 * A "view" is a session, not a page hit: all pages opened from the same IP
 * within this window count as one view. The same IP returning after a longer
 * gap starts a new view, and a never-seen IP is always a new view.
 */
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

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

  // Earliest point we report on. Load one session gap earlier so the first
  // in-window hit per IP can be correctly classified as a session start.
  const windowStart = new Date(Math.min(chartStart.getTime(), monthStart.getTime()));
  const loadStart = new Date(windowStart.getTime() - SESSION_GAP_MS);

  const [hits, distinctIps] = await Promise.all([
    prisma.pageVisit.findMany({
      where: { createdAt: { gte: loadStart } },
      select: { ip: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pageVisit.findMany({
      where: { ip: { not: null } },
      select: { ip: true },
      distinct: ["ip"],
    }),
  ]);

  // Collapse page hits into sessions: a hit starts a new session (one "view")
  // if it's the first from its IP or comes ≥ SESSION_GAP after that IP's
  // previous hit. Hits without an IP each count as their own view.
  const lastSeen = new Map<string, number>();
  const sessionStarts: Date[] = [];
  for (const h of hits) {
    const t = new Date(h.createdAt).getTime();
    if (!h.ip) {
      sessionStarts.push(new Date(t));
      continue;
    }
    const prev = lastSeen.get(h.ip);
    if (prev === undefined || t - prev >= SESSION_GAP_MS) {
      sessionStarts.push(new Date(t));
    }
    lastSeen.set(h.ip, t);
  }

  // Pre-seed 30 day buckets so the chart has no gaps.
  const buckets = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    buckets.set(dayKey(d), 0);
  }

  let today = 0;
  let week = 0;
  let month = 0;
  for (const s of sessionStarts) {
    if (s >= todayStart) today++;
    if (s >= weekStart) week++;
    if (s >= monthStart) month++;
    const key = dayKey(s);
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
