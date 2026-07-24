import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { isBotUserAgent } from "./lib/bot-filter";

// Edge-safe auth instance (no Credentials/Prisma) — reads the JWT session only.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const session = req.auth;
  const isLoggedIn = !!session;
  const role = session?.user?.role;

  // --- Route protection ---
  if (path.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(path)}`, nextUrl)
      );
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }
  if (path.startsWith("/dashboard") && !isLoggedIn) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(path)}`, nextUrl)
    );
  }

  // --- Traffic logging ---
  // Prisma can't run on the edge, so fire a non-blocking request to a Node route.
  // Only count real human page loads: skip API calls (incl. our own /api/track),
  // bots/crawlers/scrapers (they never run the client analytics either, so
  // counting them makes the admin numbers diverge wildly from GA), and Next.js
  // link prefetches (a hover is not a visit and would bloat the visit log).
  const userAgent = req.headers.get("user-agent");
  const isPrefetch =
    req.headers.get("next-router-prefetch") === "1" ||
    req.headers.get("purpose") === "prefetch" ||
    (req.headers.get("sec-purpose")?.includes("prefetch") ?? false);

  if (!path.startsWith("/api") && !isPrefetch && !isBotUserAgent(userAgent)) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    void fetch(new URL("/api/track", nextUrl.origin), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-track-secret": process.env.AUTH_SECRET ?? "",
      },
      body: JSON.stringify({
        path,
        method: req.method,
        ip,
        userAgent: userAgent ?? null,
        userId: session?.user?.id ?? null,
      }),
    }).catch(() => {});
  }

  return NextResponse.next();
});

export const config = {
  // Run on page routes; exclude Next internals, the auth API, and static files
  // (anything containing a dot, e.g. /logo.svg, /images/x.jpg).
  matcher: ["/((?!api/auth|_next|favicon.ico|.*\\..*).*)"],
};
