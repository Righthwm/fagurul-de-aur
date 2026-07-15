"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { hasAnalyticsConsent, CONSENT_CHANGE_EVENT } from "@/lib/cookie-consent";

/**
 * Meta (Facebook) Pixel for ad measurement. GDPR-gated: it loads ONLY after the
 * visitor picks "Accept toate" in the cookie banner (hasAnalyticsConsent), and
 * reacts to that choice within the same session via CONSENT_CHANGE_EVENT. The
 * inline snippet fires the load-time PageView; the effect covers SPA navigations.
 */
const PIXEL_ID = "1425534296272246";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function MetaPixel() {
  const [consented, setConsented] = useState(false);
  const pathname = usePathname();
  const skipInitial = useRef(true);

  // Track the consent decision (initial read + same-session "Accept toate").
  useEffect(() => {
    const sync = () => setConsented(hasAnalyticsConsent());
    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);

  // The inline Script fires the first PageView; this handles later navigations.
  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    if (hasAnalyticsConsent()) window.fbq?.("track", "PageView");
  }, [pathname]);

  if (!consented) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
