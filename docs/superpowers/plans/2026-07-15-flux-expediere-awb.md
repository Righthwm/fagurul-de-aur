# Flux „Expediat" + email AWB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin "Expediat" button on each order that captures the dispatch city + AWB, marks the order shipped, and emails the customer that the parcel is on its way.

**Architecture:** A Prisma migration adds `awb`/`courierCity` to `Order`. A new `sendShippingEmail` in `lib/email.ts` mails the *customer* (existing helpers only mail the shop). An ADMIN-only server action `markOrderShipped` validates input, sends the email first (all-or-nothing), then persists status + AWB. A client cell in the orders table renders the button + inline form.

**Tech Stack:** Next.js 16 App Router (server actions), Prisma (PostgreSQL/Neon), Resend, Zod, Vitest (node env — no DOM).

**Spec:** `docs/superpowers/specs/2026-07-15-flux-expediere-awb-design.md`

**Decisions locked in:** button label = "Expediat", resulting `status = "expediat"`; email `from` = `MAIL_FROM` (set to `Fagurul de Aur <comenzi@faguruldeaur.ro>` in Vercel), `replyTo` = the shop inbox (`MAIL_TO`, `faguruldeaur@gmail.com`); **all-or-nothing** (email must succeed before the order is updated).

---

## File Structure

- `prisma/schema.prisma` — add `awb`, `courierCity` to `Order` (Task 1).
- `prisma/migrations/<ts>_order_shipping_awb/migration.sql` — the migration (Task 1).
- `lib/email.ts` — add `sendShippingEmail` + `ShippingEmailData` (Task 2).
- `lib/email.test.ts` — NEW, tests `sendShippingEmail` with Resend mocked (Task 2).
- `app/admin/comenzi/actions.ts` — NEW, `markOrderShipped` server action (Task 3).
- `app/admin/comenzi/actions.test.ts` — NEW, tests the action with auth/prisma/email mocked (Task 3).
- `app/admin/comenzi/ShipOrderCell.tsx` — NEW, client cell (button + inline form) (Task 4).
- `app/admin/comenzi/page.tsx` — add the "Livrare" column wired to `ShipOrderCell` (Task 4).

---

## Task 1: Prisma migration — add `awb` + `courierCity`

**Files:**
- Modify: `prisma/schema.prisma` (the `Order` model)
- Create: `prisma/migrations/<timestamp>_order_shipping_awb/migration.sql`

- [ ] **Step 1: Add the two nullable fields to the `Order` model**

In `prisma/schema.prisma`, inside `model Order { ... }`, add these two lines right after the `paymentId` line:

```prisma
  paymentId          String?
  // Set when the order is dispatched via the admin "Expediat" action.
  awb                String?
  courierCity        String?
```

- [ ] **Step 2: Generate the migration SQL offline (local env has no direct DB URL)**

`prisma migrate dev` needs `DATABASE_URL_UNPOOLED`, which is not in local env, so generate the migration purely from the schema + existing migration history (no DB connection):

```bash
TS=$(date +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_order_shipping_awb"
mkdir -p "$DIR"
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > "$DIR/migration.sql"
cat "$DIR/migration.sql"
```

Expected `migration.sql` content (order of columns may vary):

```sql
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "awb" TEXT,
ADD COLUMN "courierCity" TEXT;
```

- [ ] **Step 3: Regenerate the Prisma client so `awb`/`courierCity` exist on the types**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Verify the schema still validates and the client typechecks**

Run: `DATABASE_URL="postgresql://u:p@localhost:5432/db" DATABASE_URL_UNPOOLED="postgresql://u:p@localhost:5432/db" npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀"

Run: `npx tsc --noEmit`
Expected: exit 0 (no errors).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(orders): add awb + courierCity columns for shipping"
```

Note: production applies this via `prisma migrate deploy` in the Vercel build; no local DB apply is needed.

---

## Task 2: `sendShippingEmail` — email the customer

**Files:**
- Modify: `lib/email.ts` (add the export near the other senders)
- Test: `lib/email.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `lib/email.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock Resend so no real email is sent. vi.hoisted lets the factory see the spy.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}));

import { sendShippingEmail } from "@/lib/email";

describe("sendShippingEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ error: null });
  });

  it("sends to the customer, replying to the shop inbox, with city + AWB", async () => {
    await sendShippingEmail({
      orderId: "SB-1",
      customerEmail: "client@example.com",
      customerFirstName: "Ana",
      courierCity: "Târgu Jiu",
      awb: "AWB123456",
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("client@example.com");
    expect(arg.replyTo).toBe("faguruldeaur@gmail.com");
    expect(arg.subject).toContain("SB-1");
    expect(arg.text).toContain("Târgu Jiu");
    expect(arg.text).toContain("AWB123456");
    expect(arg.html).toContain("AWB123456");
  });

  it("escapes HTML in customer-controlled fields", async () => {
    await sendShippingEmail({
      orderId: "SB-2",
      customerEmail: "x@y.z",
      customerFirstName: "<b>x</b>",
      courierCity: "A&B",
      awb: "1",
    });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(arg.html).toContain("A&amp;B");
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ error: { name: "bad", message: "nope" } });
    await expect(
      sendShippingEmail({
        orderId: "SB-3",
        customerEmail: "x@y.z",
        customerFirstName: "A",
        courierCity: "B",
        awb: "1",
      })
    ).rejects.toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/email.test.ts`
Expected: FAIL — `sendShippingEmail` is not exported from `@/lib/email`.

- [ ] **Step 3: Implement `sendShippingEmail`**

In `lib/email.ts`, add this after the `sendOrderEmail` function (it reuses the module's existing `getClient`, `esc`, `MAIL_FROM`, and `MAIL_TO`):

```ts
export interface ShippingEmailData {
  orderId: string;
  customerEmail: string;
  customerFirstName: string;
  courierCity: string;
  awb: string;
}

/**
 * Tells the CUSTOMER their parcel is on its way. Unlike the other senders (which
 * notify the shop at MAIL_TO), this goes to the customer's address, from the shop
 * (MAIL_FROM, a verified faguruldeaur.ro sender), with replies routed to the shop
 * inbox. Throws on failure so the caller can abort before persisting.
 */
export async function sendShippingEmail(data: ShippingEmailData): Promise<void> {
  const name = esc(data.customerFirstName);
  const orderId = esc(data.orderId);
  const city = esc(data.courierCity);
  const awb = esc(data.awb);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
      <h2 style="color:#B5700A">Comanda ta e pe drum 🚚</h2>
      <p>Salut ${name},</p>
      <p>
        Comanda <strong>${orderId}</strong> este în curs de livrare din sediul
        <strong>Fan Courier ${city}</strong>, cu numărul AWB <strong>${awb}</strong>.
      </p>
      <p>O poți urmări pe <a href="https://www.fancourier.ro/awb-tracking/" style="color:#B5700A">fancourier.ro</a> folosind codul AWB.</p>
      <p style="color:#888">Mulțumim că ai ales Fagurul de Aur! 🐝</p>
    </div>`;

  const text = [
    `Comanda ta e pe drum`,
    ``,
    `Salut ${data.customerFirstName},`,
    `Comanda ${data.orderId} este în curs de livrare din sediul Fan Courier ${data.courierCity}, cu AWB ${data.awb}.`,
    `Urmărește pe: https://www.fancourier.ro/awb-tracking/`,
    ``,
    `Mulțumim că ai ales Fagurul de Aur!`,
  ].join("\n");

  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: data.customerEmail,
    replyTo: MAIL_TO, // replies reach the shop's inbox
    subject: `Comanda ${data.orderId} a fost expediată`,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/email.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts lib/email.test.ts
git commit -m "feat(email): sendShippingEmail — notify the customer of dispatch + AWB"
```

---

## Task 3: `markOrderShipped` server action

**Files:**
- Create: `app/admin/comenzi/actions.ts`
- Test: `app/admin/comenzi/actions.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `app/admin/comenzi/actions.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";

const { authMock, findUniqueMock, updateMock, sendShippingEmailMock, revalidateMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateMock: vi.fn(),
    sendShippingEmailMock: vi.fn(),
    revalidateMock: vi.fn(),
  })
);
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: findUniqueMock, update: updateMock } },
}));
vi.mock("@/lib/email", () => ({ sendShippingEmail: sendShippingEmailMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));

import { markOrderShipped } from "@/app/admin/comenzi/actions";

const order = { orderNumber: "SB-1", customerEmail: "c@x.ro", customerFirstName: "Ana" };

describe("markOrderShipped", () => {
  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    sendShippingEmailMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(order);
    sendShippingEmailMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(order);
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(markOrderShipped("SB-1", "Târgu Jiu", "AWB1")).rejects.toThrow(/unauthorized/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects blank city or AWB without touching the DB", async () => {
    const res = await markOrderShipped("SB-1", "  ", "AWB1");
    expect(res).toEqual({ ok: false, error: expect.any(String) });
    expect(sendShippingEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does NOT update the order when the email fails (all-or-nothing)", async () => {
    sendShippingEmailMock.mockRejectedValue(new Error("smtp down"));
    const res = await markOrderShipped("SB-1", "Târgu Jiu", "AWB1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("emails then persists status + awb + city on success", async () => {
    const res = await markOrderShipped("SB-1", "Târgu Jiu", "AWB123");
    expect(res).toEqual({ ok: true });
    expect(sendShippingEmailMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledWith({
      where: { orderNumber: "SB-1" },
      data: { awb: "AWB123", courierCity: "Târgu Jiu", status: "expediat" },
    });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: FAIL — module `@/app/admin/comenzi/actions` does not exist.

- [ ] **Step 3: Implement the action**

Create `app/admin/comenzi/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendShippingEmail } from "@/lib/email";

const shipInput = z.object({
  courierCity: z.string().trim().min(2),
  awb: z.string().trim().min(3),
});

/**
 * Mark an order dispatched: validate, email the customer, then (only if the email
 * succeeded) persist status + AWB. ADMIN-only, mirroring app/admin/clienti/actions.ts.
 * Returns a result object for the UI; throws only on an auth violation.
 */
export async function markOrderShipped(
  orderId: string,
  courierCity: string,
  awb: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = shipInput.safeParse({ courierCity, awb });
  if (!parsed.success) {
    return { ok: false, error: "Completează orașul de expediere și AWB-ul." };
  }

  const order = await prisma.order.findUnique({ where: { orderNumber: orderId } });
  if (!order) {
    return { ok: false, error: "Comanda nu a fost găsită." };
  }

  // All-or-nothing: send the email first; if it fails, leave the order untouched.
  try {
    await sendShippingEmail({
      orderId: order.orderNumber,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
      courierCity: parsed.data.courierCity,
      awb: parsed.data.awb,
    });
  } catch {
    return { ok: false, error: "Emailul nu a putut fi trimis. Încearcă din nou." };
  }

  await prisma.order.update({
    where: { orderNumber: orderId },
    data: { awb: parsed.data.awb, courierCity: parsed.data.courierCity, status: "expediat" },
  });
  revalidatePath("/admin/comenzi");
  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/admin/comenzi/actions.ts app/admin/comenzi/actions.test.ts
git commit -m "feat(admin): markOrderShipped action (email-then-persist, admin-only)"
```

---

## Task 4: `ShipOrderCell` UI + wire it into the orders table

**Files:**
- Create: `app/admin/comenzi/ShipOrderCell.tsx`
- Modify: `app/admin/comenzi/page.tsx`

No unit test: the repo's Vitest runs in the node environment (no DOM). Verify via `tsc` + a lint check; the logic underneath (action) is already tested in Task 3.

- [ ] **Step 1: Create the client cell**

Create `app/admin/comenzi/ShipOrderCell.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { markOrderShipped } from "./actions";

/** Per-row control in the orders table: shows the "Expediat" button, reveals an
 *  inline city + AWB form, and calls the server action. Already-shipped orders
 *  render the saved AWB read-only so you can't dispatch twice by accident. */
export function ShipOrderCell({
  orderId,
  status,
  awb,
  courierCity,
}: {
  orderId: string;
  status: string;
  awb: string | null;
  courierCity: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [awbValue, setAwbValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (status === "expediat" || awb) {
    return (
      <span className="text-text-muted text-xs whitespace-nowrap">
        AWB {awb ?? "—"}
        {courierCity ? ` · ${courierCity}` : ""}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors"
      >
        Expediat
      </button>
    );
  }

  const submit = () => {
    setError("");
    startTransition(async () => {
      const res = await markOrderShipped(orderId, city, awbValue);
      if (!res.ok) setError(res.error);
      // On success revalidatePath re-renders the table into the read-only state.
    });
  };

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Oraș expediere"
        className="px-2 py-1 text-xs rounded-sm bg-bg-surface border border-gold-400/20 text-text-primary"
      />
      <input
        value={awbValue}
        onChange={(e) => setAwbValue(e.target.value)}
        placeholder="AWB"
        className="px-2 py-1 text-xs rounded-sm bg-bg-surface border border-gold-400/20 text-text-primary"
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="px-2 py-1 rounded-sm text-xs font-medium bg-gold-400/20 text-gold-300 hover:bg-gold-400/30 disabled:opacity-50"
        >
          {pending ? "Se trimite…" : "Trimite"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
        >
          Anulează
        </button>
      </div>
      {error && <p className="text-error text-[11px]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add the "Livrare" column to the orders table**

In `app/admin/comenzi/page.tsx`:

Add the import at the top (after the `Badge` import):

```ts
import { ShipOrderCell } from "./ShipOrderCell";
```

In the `<thead>` row, add a header cell after the `Data` header:

```tsx
                <th className="text-left font-medium px-3 py-2">Data</th>
                <th className="text-left font-medium px-3 py-2">Livrare</th>
```

In the `<tbody>` row, add a cell after the `Data` cell (the `<td>` with `toLocaleDateString`):

```tsx
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2">
                      <ShipOrderCell
                        orderId={o.orderNumber}
                        status={o.status}
                        awb={o.awb}
                        courierCity={o.courierCity}
                      />
                    </td>
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc --noEmit`
Expected: exit 0. (If `o.awb` / `o.courierCity` error as "does not exist", re-run `npx prisma generate` from Task 1.)

Run: `npx eslint app/admin/comenzi/ShipOrderCell.tsx app/admin/comenzi/page.tsx`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (existing + Task 2's 3 + Task 3's 4).

- [ ] **Step 5: Commit**

```bash
git add app/admin/comenzi/ShipOrderCell.tsx app/admin/comenzi/page.tsx
git commit -m "feat(admin): Expediat button + AWB form in the orders table"
```

---

## Self-Review

**Spec coverage:**
- DB fields `awb` + `courierCity` → Task 1. ✓
- `sendShippingEmail` to customer, from shop, replyTo shop, throws on failure → Task 2. ✓
- Message "Fan Courier {oraș} cu AWB {cod}" → Task 2 html/text. ✓
- Customer email from the order (`order.customerEmail`) → Task 3 passes it through. ✓
- ADMIN-only action, Zod validation, email-first all-or-nothing, status `expediat`, revalidate → Task 3. ✓
- Button "Expediat" → inline city + AWB form; already-shipped shows read-only AWB → Task 4. ✓
- Error surfaced under the form → Task 4 `error` state. ✓
- Non-scope (no Fan Courier API, no status timeline, no AWB editing) → respected. ✓

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `ShippingEmailData` (Task 2) matches the object `markOrderShipped` builds (Task 3). `markOrderShipped(orderId, courierCity, awb)` signature is identical in action (Task 3), test (Task 3), and `ShipOrderCell` call (Task 4). Result shape `{ ok: true } | { ok: false; error }` consistent across Task 3 + Task 4. `ShipOrderCell` props (`orderId, status, awb, courierCity`) match the `page.tsx` wiring (Task 4).
