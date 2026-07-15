/**
 * Cookie-consent choice, stored client-side. The site currently sets only
 * strictly-necessary and functional storage (auth, cart, theme, popup memory),
 * so no tracking is gated today — but the choice is recorded and persisted so
 * any future analytics/marketing code can check it via getCookieConsent()
 * before loading, and so the banner never re-prompts after a decision.
 */
export type CookieConsent = "all" | "essential" | "rejected";

const KEY = "fda-cookie-consent";

/** The saved choice, or null if the visitor hasn't decided yet. */
export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "all" || v === "essential" || v === "rejected" ? v : null;
  } catch {
    return null; // localStorage unavailable (e.g. private mode)
  }
}

/** Event fired on the window whenever the consent choice changes, so in-page
 *  analytics/marketing code can react without a reload. */
export const CONSENT_CHANGE_EVENT = "fda-consent-change";

/** Persist the visitor's choice and notify in-page listeners. */
export function setCookieConsent(value: CookieConsent): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* localStorage unavailable — the banner just won't remember the choice */
  }
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  } catch {
    /* no window (SSR) — nothing to notify */
  }
}

/** True only when the visitor explicitly accepted non-essential cookies. */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === "all";
}
