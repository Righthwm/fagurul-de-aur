import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTrafficStats } from "@/lib/traffic";

/** Aggregated traffic data — ADMIN only. */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getTrafficStats());
}
