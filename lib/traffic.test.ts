import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { pageVisit: { findMany: findManyMock } },
}));

import { getTrafficStats } from "@/lib/traffic";

// Fixed "now" at local midday so the day boundaries don't drift under the
// timestamps we build below.
const NOW = new Date(2026, 6, 21, 12, 0, 0); // 2026-07-21 12:00 local
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function dayKey(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toLocaleDateString("en-CA");
}

describe("getTrafficStats unique-IP counting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    findManyMock.mockReset();

    // createdAt asc, as the real query returns them.
    const hits = [
      { ip: "1.1.1.1", createdAt: ago(25 * HOUR) }, // yesterday
      { ip: "3.3.3.3", createdAt: ago(25 * HOUR) }, // yesterday
      { ip: "1.1.1.1", createdAt: ago(2 * HOUR) }, // today
      { ip: "1.1.1.1", createdAt: ago(5 * MIN) }, // today (new session, > gap)
      { ip: "2.2.2.2", createdAt: ago(1 * MIN) }, // today
    ];
    const distinctRows = [
      { ip: "1.1.1.1" },
      { ip: "2.2.2.2" },
      { ip: "3.3.3.3" },
      { ip: "9.9.9.9" }, // an IP only seen outside the 30-day window
    ];
    findManyMock.mockImplementation(async (args?: { distinct?: unknown }) =>
      args?.distinct ? distinctRows : hits
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts distinct IPs per period", async () => {
    const s = await getTrafficStats();
    expect(s.uniqueToday).toBe(2); // 1.1.1.1, 2.2.2.2
    expect(s.uniqueWeek).toBe(3); // + 3.3.3.3 yesterday
    expect(s.uniqueMonth).toBe(3);
    expect(s.uniqueIps).toBe(4); // all-time, from the distinct query
  });

  it("counts distinct IPs and sessions per day", async () => {
    const s = await getTrafficStats();
    expect(s.daily).toHaveLength(30);

    const today = s.daily.find((d) => d.date === dayKey(NOW));
    expect(today?.uniqueIps).toBe(2); // 1.1.1.1, 2.2.2.2
    expect(today?.visits).toBe(3); // three session starts today

    const yesterday = s.daily.find((d) => d.date === dayKey(ago(25 * HOUR)));
    expect(yesterday?.uniqueIps).toBe(2); // 1.1.1.1, 3.3.3.3
  });
});
