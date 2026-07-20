import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { OrderActionsCell } from "./OrderActionsCell";

export const metadata: Metadata = { title: "Admin · Comenzi" };
export const dynamic = "force-dynamic";

const paymentClass = (status: string) =>
  status === "paid"
    ? "text-success"
    : status === "failed"
      ? "text-error"
      : status === "pending"
        ? "text-amber-300"
        : "text-text-muted";

const orderDate = (d: Date) =>
  new Date(d).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  const parsed = orders.map((o) => {
    const items = JSON.parse(o.items) as { name: string; quantity: number }[];
    return { ...o, itemCount: items.reduce((s, i) => s + i.quantity, 0) };
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-text-primary">Comenzi ({orders.length})</h1>

      {orders.length === 0 ? (
        <p className="text-text-muted text-sm">Nicio comandă încă.</p>
      ) : (
        <>
          {/* Phone: order cards; actions reuse OrderActionsCell as-is. */}
          <div className="md:hidden space-y-3">
            {parsed.map((o) => (
              <div
                key={o.id}
                className="border border-gold-400/10 rounded-sm bg-bg-surface p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-text-primary">{o.orderNumber}</span>
                  <Badge color="gold">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                </div>
                <div className="text-sm text-text-secondary">
                  {o.customerFirstName} {o.customerLastName}
                  <a href={`tel:${o.customerPhone}`} className="block text-gold-300 text-xs mt-0.5">
                    {o.customerPhone}
                  </a>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-text-muted">
                  <span>{orderDate(o.createdAt)}</span>
                  <span>{o.itemCount} buc.</span>
                  <span className={paymentClass(o.paymentStatus)}>
                    {PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus}
                  </span>
                  <span className="text-gold-300 font-semibold text-sm">
                    {formatPrice(o.total)}
                  </span>
                </div>
                <div className="pt-1 border-t border-gold-400/10">
                  <OrderActionsCell
                    orderId={o.orderNumber}
                    status={o.status}
                    awb={o.awb}
                    courierCity={o.courierCity}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: the existing table, unchanged. */}
          <div className="hidden md:block overflow-x-auto border border-gold-400/10 rounded-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-surface text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left font-medium px-3 py-2">Comandă</th>
                  <th className="text-left font-medium px-3 py-2">Client</th>
                  <th className="text-left font-medium px-3 py-2">Produse</th>
                  <th className="text-right font-medium px-3 py-2">Total</th>
                  <th className="text-left font-medium px-3 py-2">Plată</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-left font-medium px-3 py-2">Data</th>
                  <th className="text-left font-medium px-3 py-2">Livrare</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((o) => (
                  <tr key={o.id} className="border-t border-gold-400/8 align-top">
                    <td className="px-3 py-2 text-text-primary font-mono text-xs">
                      {o.orderNumber}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {o.customerFirstName} {o.customerLastName}
                      <span className="block text-text-muted text-xs">{o.customerEmail}</span>
                    </td>
                    <td className="px-3 py-2 text-text-muted">{o.itemCount} buc.</td>
                    <td className="px-3 py-2 text-right text-gold-300">{formatPrice(o.total)}</td>
                    <td className="px-3 py-2">
                      <span className={paymentClass(o.paymentStatus)}>
                        {PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge color="gold">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                      {orderDate(o.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <OrderActionsCell
                        orderId={o.orderNumber}
                        status={o.status}
                        awb={o.awb}
                        courierCity={o.courierCity}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
