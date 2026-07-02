import Link from "next/link";
import type { ReactNode } from "react";

/** Shared article typography — keeps every blog post visually consistent and
 *  uses the site's design tokens. */

export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-text-secondary text-lg leading-relaxed mb-6">{children}</p>;
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-heading text-text-primary mt-10 mb-3 scroll-mt-28" style={{ fontSize: "1.6rem" }}>
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="font-heading text-text-primary text-xl mt-6 mb-2">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-text-secondary leading-relaxed mb-4">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2 text-text-secondary mb-4 marker:text-gold-400">{children}</ul>;
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-2 text-text-secondary mb-4 marker:text-gold-400">{children}</ol>;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const internal = href.startsWith("/");
  if (internal) {
    return (
      <Link href={href} className="text-gold-300 hover:underline">
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-gold-300 hover:underline">
      {children}
    </a>
  );
}

/** Inline call-to-action card linking back into the shop. */
export function ShopCTA({ children, href = "/miere", label = "Vezi mierea naturală" }: { children: ReactNode; href?: string; label?: string }) {
  return (
    <div className="my-8 rounded-sm border border-gold-400/20 bg-bg-surface p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <p className="text-text-secondary text-sm leading-relaxed m-0">{children}</p>
      <Link href={href} className="btn-primary shrink-0 text-center">
        {label}
      </Link>
    </div>
  );
}
