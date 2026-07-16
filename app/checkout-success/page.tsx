import type { Metadata } from "next";
import { CheckoutSuccess } from "./CheckoutSuccess";

export const metadata: Metadata = { title: "Comandă plasată" };
export const dynamic = "force-dynamic";

/**
 * Dedicated post-purchase "thank you" page. Both flows land here only on success
 * — ramburs after the order is placed, card after the payment is confirmed — so
 * its stable URL (/checkout-success) can drive a Meta/GA purchase conversion
 * trigger that fires on every completed order and never on a failure.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; total?: string; payment?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order ?? null;
  const totalNum = params.total != null ? Number(params.total) : NaN;
  const total = Number.isFinite(totalNum) ? totalNum : null;
  const payment = params.payment === "card" ? "card" : "ramburs";

  return (
    <div className="bg-bg-primary pt-20 min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="card p-10">
          <CheckoutSuccess orderId={orderId} total={total} payment={payment} />
        </div>
      </div>
    </div>
  );
}
