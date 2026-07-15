import type { Metadata } from "next";
import { PaymentReturnStatus } from "./PaymentReturnStatus";

export const metadata: Metadata = { title: "Rezultat plată" };
export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string | string[]; orderID?: string | string[] }>;
}) {
  // Read our own `orderId`, accepting Netopia's `orderID` casing as a fallback.
  // Netopia echoes the id back on the redirect, so the param can arrive twice —
  // Next.js then hands it over as an array. Collapse it to a single clean value.
  const params = await searchParams;
  const raw = params.orderId ?? params.orderID ?? null;
  const orderId = (Array.isArray(raw) ? raw[0] : raw) ?? null;

  return (
    <div className="bg-bg-primary pt-20 min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="card p-10">
          <PaymentReturnStatus orderId={orderId} />
        </div>
      </div>
    </div>
  );
}
