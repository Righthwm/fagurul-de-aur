import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fără conexiune" };

/** Static fallback served by the service worker when a navigation fails. */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-heading text-2xl text-text-primary mb-2">Fără conexiune</h1>
        <p className="text-text-secondary text-sm mb-6">
          Verifică internetul și încearcă din nou.
        </p>
        <a href="/admin" className="btn-primary">
          Reîncearcă
        </a>
      </div>
    </div>
  );
}
