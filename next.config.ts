import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The shop moved from /magazin to /miere. Permanently redirect the old
    // (already-indexed) URLs so SEO ranking and existing links are preserved.
    return [
      { source: "/magazin", destination: "/miere", permanent: true },
      { source: "/magazin/:slug", destination: "/miere/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
