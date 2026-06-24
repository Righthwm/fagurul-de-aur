"use client";

// Renders an inline script that executes during HTML parsing (before first
// paint) on hard navigations, but is inert ("text/plain") when React renders
// it on the client — avoiding React's dev warning about script tags.
// Pattern from the Next.js guide: preventing-flash-before-hydration.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
