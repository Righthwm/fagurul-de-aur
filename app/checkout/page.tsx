"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreditCard,
  Banknote,
  Truck,
  ShieldCheck,
  Lock,
  ShoppingBasket,
  AlertCircle,
} from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { orderableBonusKeys } from "@/lib/promo";
import { couponDiscount, couponFreeShipping } from "@/lib/coupons";
import { formatPrice } from "@/lib/utils";
import { trackInitiateCheckout } from "@/lib/analytics";
import { HexPattern } from "@/components/ui/HexPattern";
import { HoneyDropLoader } from "@/components/ui/HoneyDropLoader";
import { PaymentBadges } from "@/components/ui/PaymentBadges";

const counties = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani", "Brașov",
  "Brăila", "București", "Buzău", "Caraș-Severin", "Călărași", "Cluj", "Constanța",
  "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu", "Gorj", "Harghita", "Hunedoara",
  "Ialomița", "Iași", "Ilfov", "Maramureș", "Mehedinți", "Mureș", "Neamț", "Olt",
  "Prahova", "Satu Mare", "Sălaj", "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea",
  "Vaslui", "Vâlcea", "Vrancea",
];

const schema = z
  .object({
    firstName: z.string().min(2, "Minim 2 caractere"),
    lastName: z.string().min(2, "Minim 2 caractere"),
    email: z.string().email("Email invalid"),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s.-]/g, ""))
      .pipe(z.string().regex(/^(\+40|0)?7\d{8}$/, "Telefon invalid (ex: 07XX XXX XXX)")),
    county: z.string().min(1, "Alege județul"),
    city: z.string().min(1, "Alege localitatea"),
    address: z.string().min(5, "Strada, numărul, bloc/apartament"),
    postalCode: z.string().regex(/^\d{6}$/, "Cod poștal din 6 cifre"),
    paymentMethod: z.enum(["card", "ramburs"]),
    notes: z.string().optional(),
    terms: z.boolean().refine((v) => v === true, "Trebuie să accepți termenii și condițiile"),
  });

type FormData = z.infer<typeof schema>;

function Field({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs text-text-muted uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-error text-xs mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const { items, totalPrice } = useCartStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  // Card payment is only available once Netopia is configured (server tells us).
  const [cardEnabled, setCardEnabled] = useState(false);
  // Discount coupon (validated again server-side on submit).
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/payment/config")
      .then((r) => r.json())
      .then((d: { cardEnabled: boolean }) => setCardEnabled(!!d.cardEnabled))
      .catch(() => setCardEnabled(false));
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMethod: "ramburs", terms: false },
  });

  const paymentMethod = watch("paymentMethod");
  // Exclude bonus lines the cart no longer qualifies for ("indisponibil momentan")
  // from the order; the server re-validates the rest. Shared with the cart drawer
  // so both agree on which bonus lines are available. Gated on card payment: bonus
  // jars are only orderable when paying by card.
  const orderableKeys = orderableBonusKeys(items, paymentMethod === "card");
  const orderableItems = items.filter((i) => !i.isBonus || orderableKeys.has(i.bonusKey!));
  // How many bonus jars the customer would actually receive on card — excludes any
  // over-entitled line that card wouldn't deliver, so the nudge can't overpromise.
  const cardBonusCount = orderableBonusKeys(items, true).size;
  const county = watch("county");
  const locality = watch("city");

  // Gate cart-derived values on `mounted`: the cart is rehydrated from
  // localStorage on the client, so reading it during SSR / first render would
  // mismatch. Until mounted, render the same neutral values the server does.
  const subtotal = mounted ? totalPrice() : 0;

  // Fire InitiateCheckout / begin_checkout once the rehydrated cart has paid
  // items to check out.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!mounted || checkoutTracked.current) return;
    const paid = orderableItems.filter((i) => !i.isBonus);
    if (paid.length === 0) return;
    checkoutTracked.current = true;
    trackInitiateCheckout(
      paid.map((i) => ({
        id: i.product.id,
        name: i.product.name,
        price: i.selectedVariant.price,
        quantity: i.quantity,
      }))
    );
  }, [mounted, orderableItems]);

  // ---- Delivery fee (flat: 30 lei oraș / 50 lei sat, by locality) ----
  type Estimate =
    | { status: "idle" | "loading" | "unavailable" }
    | { status: "available"; cost: number };
  const [localities, setLocalities] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<Estimate>({ status: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable signature of the cart so the estimate effect re-runs on cart changes.
  const itemsSig = items
    .map((i) => `${i.product.id}:${i.selectedVariant.price}x${i.quantity}`)
    .join(",");

  // County → load its localities, reset the chosen locality.
  useEffect(() => {
    setValue("city", "");
    if (!county) {
      setLocalities([]);
      return;
    }
    let active = true;
    fetch(`/api/shipping/localities?county=${encodeURIComponent(county)}`)
      .then((r) => r.json())
      .then((d: { localities: string[] }) => {
        if (active) setLocalities(d.localities ?? []);
      })
      .catch(() => active && setLocalities([]));
    return () => {
      active = false;
    };
  }, [county, setValue]);

  // Address + cart → debounced shipping estimate.
  useEffect(() => {
    if (!mounted || items.length === 0) return;
    if (!county || !locality) {
      setEstimate({ status: "idle" });
      return;
    }
    setEstimate({ status: "loading" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch("/api/shipping/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          county,
          locality,
          paymentMethod,
          items: orderableItems.map((i) => ({
            productId: i.product.id,
            variantPrice: i.selectedVariant.price,
            quantity: i.quantity,
          })),
        }),
      })
        .then((r) => r.json())
        .then((d: { cost: number | null }) => {
          if (typeof d.cost === "number") setEstimate({ status: "available", cost: d.cost });
          else setEstimate({ status: "unavailable" });
        })
        .catch(() => setEstimate({ status: "unavailable" }));
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, county, locality, paymentMethod, itemsSig]);

  const rawShippingCost = estimate.status === "available" ? estimate.cost : 0;
  const freeShipping = couponFreeShipping(appliedCoupon);
  const shippingCost = freeShipping ? 0 : rawShippingCost;
  const discount = couponDiscount(subtotal, appliedCoupon);
  const total = Math.max(0, subtotal + shippingCost - discount);

  const [couponLoading, setCouponLoading] = useState(false);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const json: { valid: boolean; code?: string; message?: string } = await res.json();
      if (!json.valid || !json.code) {
        setAppliedCoupon(null);
        setCouponError(json.message ?? "Cod invalid.");
        return;
      }
      setAppliedCoupon(json.code);
      setCouponInput(json.code);
    } catch {
      setCouponError("Nu am putut valida codul. Încearcă din nou.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const onSubmit = async (data: FormData) => {
    setStatus("loading");
    const payload = {
      customer: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      },
      shippingAddress: {
        county: data.county,
        city: data.city,
        address: data.address,
        postalCode: data.postalCode,
      },
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      couponCode: appliedCoupon ?? undefined,
      items: orderableItems.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        variant: i.selectedVariant.weight ?? i.selectedVariant.type,
        unitPrice: i.selectedVariant.price,
        quantity: i.quantity,
        isBonus: i.isBonus,
        bonusSource: i.bonusSource,
      })),
    };

    try {
      if (data.paymentMethod === "card") {
        // Create a pending order + start Netopia, then go to the hosted card page.
        const res = await fetch("/api/payment/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json: { redirectUrl?: string } = await res.json();
        if (!res.ok || !json.redirectUrl) throw new Error("failed");
        window.location.href = json.redirectUrl; // browser navigates to Netopia
        return;
      }

      // Ramburs: persist, then hand off to the shared success page (which fires
      // the Purchase conversion and clears the cart).
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      const json: { orderId: string; totals?: { total: number } } = await res.json();
      const finalTotal = json.totals?.total ?? total;
      router.push(
        `/checkout-success?order=${encodeURIComponent(json.orderId)}&total=${finalTotal}&payment=ramburs`
      );
    } catch {
      setStatus("error");
    }
  };

  /* ---- Empty cart ---- */
  if (mounted && items.length === 0) {
    return (
      <div className="bg-bg-primary pt-20 min-h-screen">
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <ShoppingBasket size={56} className="text-text-muted opacity-30 mx-auto mb-5" />
          <h1 className="font-heading text-text-primary mb-3" style={{ fontSize: "2rem" }}>
            Coșul tău este gol
          </h1>
          <p className="text-text-secondary mb-8">
            Adaugă produse în coș pentru a finaliza o comandă.
          </p>
          <Link href="/miere" className="btn-primary">
            Descoperă produsele
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-primary pt-20 min-h-screen">
      {/* Header */}
      <div className="relative bg-bg-secondary border-b border-gold-400/10 overflow-hidden">
        <HexPattern opacity={0.025} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <span className="gold-line" />
          <h1 className="font-heading text-text-primary" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
            Finalizare Comandă
          </h1>
          <div className="flex items-center justify-center gap-5 mt-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><Lock size={13} className="text-gold-400" /> Plată securizată</span>
            <span className="flex items-center gap-1.5"><Truck size={13} className="text-gold-400" /> Livrare 24–48h</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-gold-400" /> Retur 14 zile</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* ---- Left: form ---- */}
          <div className="lg:col-span-3 space-y-10">
            {/* Contact */}
            <section aria-label="Date de contact">
              <h2 className="font-heading text-xl text-text-primary mb-5 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-gold-400 text-bg-primary text-sm font-body font-bold flex items-center justify-center">1</span>
                Date de contact
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Prenume *" htmlFor="firstName" error={errors.firstName?.message}>
                  <input id="firstName" type="text" autoComplete="given-name" placeholder="Ion"
                    className={`input-field ${errors.firstName ? "error" : ""}`} {...register("firstName")} />
                </Field>
                <Field label="Nume *" htmlFor="lastName" error={errors.lastName?.message}>
                  <input id="lastName" type="text" autoComplete="family-name" placeholder="Popescu"
                    className={`input-field ${errors.lastName ? "error" : ""}`} {...register("lastName")} />
                </Field>
                <Field label="Email *" htmlFor="email" error={errors.email?.message}>
                  <input id="email" type="email" autoComplete="email" placeholder="email@exemplu.ro"
                    className={`input-field ${errors.email ? "error" : ""}`} {...register("email")} />
                </Field>
                <Field label="Telefon *" htmlFor="phone" error={errors.phone?.message}>
                  <input id="phone" type="tel" autoComplete="tel" placeholder="07XX XXX XXX"
                    className={`input-field ${errors.phone ? "error" : ""}`} {...register("phone")} />
                </Field>
              </div>
            </section>

            {/* Address */}
            <section aria-label="Adresa de livrare">
              <h2 className="font-heading text-xl text-text-primary mb-5 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-gold-400 text-bg-primary text-sm font-body font-bold flex items-center justify-center">2</span>
                Adresa de livrare
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Județ *" htmlFor="county" error={errors.county?.message}>
                  <select id="county" autoComplete="address-level1"
                    className={`input-field ${errors.county ? "error" : ""}`} {...register("county")}>
                    <option value="">Alege județul…</option>
                    {counties.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Localitate *" htmlFor="city" error={errors.city?.message}>
                  <select id="city" autoComplete="address-level2" disabled={!county || localities.length === 0}
                    className={`input-field ${errors.city ? "error" : ""}`} {...register("city")}>
                    <option value="">{county ? "Alege localitatea…" : "Alege întâi județul"}</option>
                    {localities.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Cod poștal *" htmlFor="postalCode" error={errors.postalCode?.message}>
                  <input id="postalCode" type="text" inputMode="numeric" autoComplete="postal-code" placeholder="400001"
                    className={`input-field ${errors.postalCode ? "error" : ""}`} {...register("postalCode")} />
                </Field>
                <Field label="Adresă completă *" htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
                  <input id="address" type="text" autoComplete="street-address"
                    placeholder="Str. Florilor nr. 12, bl. A2, sc. 1, ap. 5"
                    className={`input-field ${errors.address ? "error" : ""}`} {...register("address")} />
                </Field>
              </div>
            </section>

            {/* Payment */}
            <section aria-label="Metoda de plată">
              <h2 className="font-heading text-xl text-text-primary mb-5 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-gold-400 text-bg-primary text-sm font-body font-bold flex items-center justify-center">3</span>
                Metoda de plată
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5" role="radiogroup" aria-label="Alege metoda de plată">
                <label
                  className={`flex items-start gap-3 p-4 border rounded-sm cursor-pointer transition-all ${
                    paymentMethod === "ramburs"
                      ? "border-gold-400 bg-gold-400/8"
                      : "border-gold-400/20 hover:border-gold-400/40"
                  }`}
                >
                  <input type="radio" value="ramburs" className="sr-only" {...register("paymentMethod")} />
                  <Banknote size={20} className={paymentMethod === "ramburs" ? "text-gold-300 mt-0.5" : "text-text-muted mt-0.5"} />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">Ramburs la livrare</span>
                    <span className="block text-xs text-text-muted mt-0.5">
                      Plătești curierului la primire
                    </span>
                  </span>
                </label>

                <label
                  className={`flex items-start gap-3 p-4 border rounded-sm transition-all ${
                    !cardEnabled
                      ? "border-gold-400/15 opacity-50 cursor-not-allowed"
                      : paymentMethod === "card"
                        ? "border-gold-400 bg-gold-400/8 cursor-pointer"
                        : "border-gold-400/20 hover:border-gold-400/40 cursor-pointer"
                  }`}
                >
                  <input type="radio" value="card" disabled={!cardEnabled} className="sr-only" {...register("paymentMethod")} />
                  <CreditCard size={20} className={paymentMethod === "card" && cardEnabled ? "text-gold-300 mt-0.5" : "text-text-muted mt-0.5"} />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">Card bancar (Netopia)</span>
                    <span className="block text-xs text-text-muted mt-0.5">
                      {cardEnabled
                        ? "Redirecționare către pagina securizată Netopia (3D Secure)"
                        : "Disponibilă în curând"}
                    </span>
                  </span>
                </label>
              </div>

              {paymentMethod !== "card" && cardBonusCount > 0 && (
                <div className="mb-5 flex items-start gap-2 rounded-sm border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-text-primary">
                  <CreditCard size={18} className="text-gold-300 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-gold-300">Plătește cu cardul</strong> și primești{" "}
                    {cardBonusCount === 1
                      ? "borcanul gratuit"
                      : `cele ${cardBonusCount} borcane gratuite`}
                    . La plata ramburs, borcanele bonus nu sunt incluse.
                  </span>
                </div>
              )}

              {paymentMethod === "card" && cardEnabled && (
                <div className="bg-bg-surface border border-gold-400/15 rounded-sm p-4 flex items-start gap-2 text-xs text-text-muted">
                  <Lock size={14} className="text-gold-400 shrink-0 mt-0.5" />
                  După „Plătește”, vei fi redirecționat către pagina securizată Netopia pentru a
                  introduce datele cardului (3D Secure). Nu stocăm datele cardului.
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <PaymentBadges />
                <span className="text-xs text-text-muted">Plată securizată prin NETOPIA Payments</span>
              </div>
            </section>

            {/* Notes */}
            <section aria-label="Observații">
              <Field label="Observații comandă (opțional)" htmlFor="notes">
                <textarea id="notes" rows={3} placeholder="Instrucțiuni pentru livrare, interfon, etc."
                  className="input-field resize-none" {...register("notes")} />
              </Field>
            </section>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer group" htmlFor="terms">
                <input id="terms" type="checkbox" className="sr-only" {...register("terms")} />
                <span
                  className={`w-4 h-4 mt-0.5 border rounded-sm flex items-center justify-center shrink-0 transition-colors ${
                    watch("terms")
                      ? "bg-gold-400 border-gold-400"
                      : errors.terms
                        ? "border-error"
                        : "border-gold-400/30 group-hover:border-gold-400/60"
                  }`}
                  aria-hidden="true"
                >
                  {watch("terms") && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L4 7L9 1" stroke="#0D0A06" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-text-muted">
                  Am citit și sunt de acord cu{" "}
                  <Link href="/termeni" className="text-gold-300 hover:underline">Termenii & Condițiile</Link>{" "}
                  și{" "}
                  <Link href="/gdpr" className="text-gold-300 hover:underline">Politica GDPR</Link>. *
                </span>
              </label>
              {errors.terms && (
                <p className="text-error text-xs mt-1.5 ml-7" role="alert">{errors.terms.message}</p>
              )}
            </div>
          </div>

          {/* ---- Right: order summary ---- */}
          <aside className="lg:col-span-2" aria-label="Sumar comandă">
            <div className="card p-6 lg:sticky lg:top-24">
              <h2 className="font-heading text-xl text-text-primary mb-5">Sumar comandă</h2>

              {mounted && (
                <ul className="space-y-3 mb-5 max-h-72 overflow-y-auto pr-1">
                  {items.map((item) => {
                    const variantLabel = item.selectedVariant.weight ?? item.selectedVariant.type ?? "";
                    const bonusUnavailable =
                      item.isBonus && (item.bonusKey == null || !orderableKeys.has(item.bonusKey));
                    return (
                      <li
                        key={item.isBonus ? `bonus-${item.bonusKey}` : `${item.product.id}-${item.selectedVariant.price}`}
                        className="flex items-center gap-3 pb-3 border-b border-gold-400/8"
                      >
                        <div
                          className="relative w-11 h-11 rounded-sm shrink-0 overflow-hidden border border-gold-400/10"
                          style={{ background: `radial-gradient(circle at 35% 30%, ${item.product.color}33, ${item.product.color}11)` }}
                        >
                          {item.product.image ? (
                            <Image
                              src={item.product.image}
                              alt={item.product.name}
                              fill
                              sizes="44px"
                              className="object-contain p-0.5 drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary text-sm truncate">
                            {item.isBonus ? `${item.product.name} (bonus)` : item.product.name}
                          </p>
                          <p className="text-text-muted text-xs">
                            {variantLabel} × {item.quantity}
                            {bonusUnavailable && (
                              <span className="text-amber-300">
                                {paymentMethod === "card" ? " · indisponibil momentan" : " · doar cu plata card"}
                              </span>
                            )}
                          </p>
                        </div>
                        {item.isBonus ? (
                          <span
                            className={`text-sm font-semibold uppercase tracking-wide shrink-0 ${
                              bonusUnavailable ? "text-text-muted line-through" : "text-success"
                            }`}
                          >
                            Gratuit
                          </span>
                        ) : (
                          <span className="text-gold-300 text-sm font-semibold shrink-0">
                            {formatPrice(item.selectedVariant.price * item.quantity)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <dl className="space-y-2 text-sm mb-5">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Subtotal</dt>
                  <dd className="text-text-primary">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Livrare</dt>
                  <dd>
                    {estimate.status === "available" ? (
                      freeShipping ? (
                        <span className="text-success">
                          <span className="text-text-muted line-through mr-1">
                            {formatPrice(estimate.cost)}
                          </span>
                          Gratuit
                        </span>
                      ) : (
                        <span className="text-text-primary">{formatPrice(estimate.cost)}</span>
                      )
                    ) : estimate.status === "loading" ? (
                      <span className="text-text-muted">Se calculează…</span>
                    ) : estimate.status === "unavailable" ? (
                      <span className="text-text-primary">Se calculează la livrare</span>
                    ) : (
                      <span className="text-text-muted">Se calculează după introducerea adresei</span>
                    )}
                  </dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Reducere ({appliedCoupon})</dt>
                    <dd className="text-success">−{formatPrice(discount)}</dd>
                  </div>
                )}
              </dl>

              {/* Coupon */}
              <div className="mb-5">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-sm bg-bg-elevated border border-gold-400/20 rounded-sm px-3 py-2">
                    <span className="text-success">
                      Cod <strong>{appliedCoupon}</strong> aplicat
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-text-muted hover:text-gold-300 text-xs"
                    >
                      Elimină
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value);
                        setCouponError("");
                      }}
                      placeholder="Cod reducere"
                      className="input-field flex-1 uppercase placeholder:normal-case"
                      aria-label="Cod reducere"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponLoading}
                      className="btn-secondary shrink-0 text-sm px-4"
                    >
                      {couponLoading ? "Se verifică…" : "Aplică"}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-error text-xs mt-1">{couponError}</p>}
              </div>

              <div className="flex justify-between items-baseline pt-4 border-t border-gold-400/15 mb-6">
                <span className="text-text-secondary font-body text-sm uppercase tracking-wider">Total</span>
                <span className="font-heading text-2xl text-gold-300">{formatPrice(total)}</span>
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 text-error text-sm mb-4" role="alert">
                  <AlertCircle size={15} />
                  A apărut o eroare. Te rugăm să încerci din nou.
                </div>
              )}

              <button type="submit" className="btn-primary w-full gap-3" disabled={status === "loading"}>
                {status === "loading" ? (
                  <>
                    <HoneyDropLoader size={20} />
                    Se procesează…
                  </>
                ) : paymentMethod === "card" ? (
                  <>
                    <Lock size={15} />
                    Plătește {formatPrice(total)}
                  </>
                ) : (
                  <>
                    <Truck size={15} />
                    Plasează comanda
                  </>
                )}
              </button>

              <p className="text-text-muted text-xs text-center mt-4 flex items-center justify-center gap-1.5">
                <ShieldCheck size={12} className="text-gold-400" />
                Garanție puritate 100% sau banii înapoi
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
