import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/components/layout/Navbar";
import { InlineScript } from "@/components/ui/InlineScript";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/shop/CartDrawer";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant-var",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter-var",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Fagurul de Aur — Miere Artizanală Pură, 100% Naturală",
    template: "%s — Fagurul de Aur",
  },
  description:
    "Miere artizanală 100% naturală, recoltată manual în Gorj — fără antibiotice, fără zahăr. Salcâm, tei, munte. Livrare în România 24–48h.",
  keywords: [
    "miere naturală",
    "miere pură",
    "miere de salcâm",
    "miere artizanală",
    "fagurul de aur",
    "miere românească",
    "produse apicole",
  ],
  authors: [{ name: "Fagurul de Aur" }],
  openGraph: {
    title: "Fagurul de Aur — Miere Artizanală Pură, 100% Naturală",
    description:
      "Miere naturală pură online, direct de la stupină. Salcâm, tei, munte, propolis — extracție la rece, garanție puritate. Livrare rapidă.",
    type: "website",
    locale: "ro_RO",
    siteName: "Fagurul de Aur",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fagurul de Aur",
    description: "Miere artizanală pură, 100% naturală, din România.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={`${cormorant.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid flash */}
        <InlineScript html={`(function(){try{if(localStorage.getItem("fagurul-de-aur-theme")==="light")document.documentElement.classList.add("light")}catch(e){}})();`} />
      </head>
      <body className="min-h-screen flex flex-col">
        {/* No server-side session here: keeps public pages statically generated.
            AuthNav fetches the session client-side via useSession. */}
        <SessionProvider>
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <CartDrawer />
        </SessionProvider>
      </body>
    </html>
  );
}
