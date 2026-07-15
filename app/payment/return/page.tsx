import type { Metadata } from "next";
import { PaymentReturnStatus } from "./PaymentReturnStatus";

export const metadata: Metadata = { title: "Rezultat plată" };
export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; orderID?: string }>;
}) {
  // Read our own `orderId`, but accept Netopia's `orderID` casing as a fallback.
  const params = await searchParams;
  const orderId = params.orderId ?? params.orderID ?? null;

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
