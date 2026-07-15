"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js). Loads on every visit (not gated on cookie
 * consent, matching the Meta Pixel per the shop owner's decision). The config
 * call fires the load-time page_view; the effect fires page_view on subsequent
 * SPA navigations.
 */
const GA_ID = "G-V8RMNCFQDG";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const skipInitial = useRef(true);

  // gtag('config') fires the first page_view; this handles later navigations.
  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    window.gtag?.("event", "page_view", { page_path: pathname });
  }, [pathname]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
