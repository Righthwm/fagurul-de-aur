# Anulare + Ștergere comandă — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Anulare" (cancel + email) and "Șterge" (hard-delete) buttons to each row in the admin orders table.

**Architecture:** Mirrors the existing "Expediat" flow. A new `sendCancellationEmail` sender, two new ADMIN-only server actions (`cancelOrder`, `deleteOrder`) in the existing actions file, and the per-row cell renamed from `ShipOrderCell` to `OrderActionsCell` gains the two buttons with inline confirmation.

**Tech Stack:** Next.js 16 App Router, server actions, Prisma, Resend, Zod (not needed here), Vitest (node env — no DOM).

**Spec:** `docs/superpowers/specs/2026-07-15-anulare-comanda-design.md`

---

## File structure

- `lib/email.ts` — add `sendCancellationEmail` (Task 1)
- `lib/email.test.ts` — add its tests (Task 1)
- `app/admin/comenzi/actions.ts` — add `cancelOrder` (Task 2) and `deleteOrder` (Task 3)
- `app/admin/comenzi/actions.test.ts` — add tests for both (Tasks 2, 3)
- `app/admin/comenzi/OrderActionsCell.tsx` — new, replaces `ShipOrderCell.tsx` (Task 4)
- `app/admin/comenzi/ShipOrderCell.tsx` — deleted (Task 4)
- `app/admin/comenzi/page.tsx` — import + tag rename (Task 4)

Note: this codebase runs Vitest in the **node** environment (no jsdom); client components are not unit-tested. Task 4 is verified with `tsc` + `next build` + manual check.

---

### Task 1: `sendCancellationEmail`

**Files:**
- Modify: `lib/email.ts` (add after `sendShippingEmail`, before `ContactEmailData`, ~line 229)
- Test: `lib/email.test.ts` (add a describe block; update the import line)

- [ ] **Step 1: Write the failing tests**

In `lib/email.test.ts`, change the import line:

```ts
import { sendShippingEmail, sendCancellationEmail } from "@/lib/email";
```

Then append this describe block at the end of the file:

```ts
describe("sendCancellationEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ error: null });
  });

  it("sends to the customer, replying to the shop inbox, with the cancellation message", async () => {
    await sendCancellationEmail({
      orderId: "SB-9",
      customerEmail: "client@example.com",
      customerFirstName: "Ana",
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("client@example.com");
    expect(arg.replyTo).toBe("faguruldeaur@gmail.com");
    expect(arg.subject).toContain("SB-9");
    expect(arg.text).toContain("a fost anulată");
    expect(arg.html).toContain("a fost anulată");
  });

  it("escapes HTML in the customer name", async () => {
    await sendCancellationEmail({
      orderId: "SB-10",
      customerEmail: "x@y.z",
      customerFirstName: "<b>x</b>",
    });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ error: { name: "bad", message: "nope" } });
    await expect(
      sendCancellationEmail({ orderId: "SB-11", customerEmail: "x@y.z", customerFirstName: "A" })
    ).rejects.toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/email.test.ts`
Expected: FAIL — `sendCancellationEmail` is not exported (import error / undefined).

- [ ] **Step 3: Implement `sendCancellationEmail`**

In `lib/email.ts`, add after the `sendShippingEmail` function (after line 228):

```ts
export interface CancellationEmailData {
  orderId: string;
  customerEmail: string;
  customerFirstName: string;
}

/**
 * Tells the CUSTOMER their order was cancelled. Like sendShippingEmail, it goes
 * to the customer from the shop sender (MAIL_FROM) with replies routed to the
 * shop inbox. Throws on failure so the caller can abort before persisting.
 */
export async function sendCancellationEmail(data: CancellationEmailData): Promise<void> {
  const name = esc(data.customerFirstName);
  const orderId = esc(data.orderId);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
      <h2 style="color:#B5700A">Comanda ta a fost anulată</h2>
      <p>Salut ${name},</p>
      <p>
        Ne pare rău, dar comanda <strong>${orderId}</strong> nu a putut fi procesată
        și a fost anulată. Te rugăm să refaci comanda.
      </p>
      <p><a href="https://faguruldeaur.ro/miere" style="color:#B5700A">Reia comanda →</a></p>
      <p style="color:#888">Îți mulțumim pentru înțelegere! 🐝</p>
    </div>`;

  const text = [
    `Comanda ta a fost anulată`,
    ``,
    `Salut ${data.customerFirstName},`,
    `Ne pare rău, dar comanda ${data.orderId} nu a putut fi procesată și a fost anulată. Te rugăm să refaci comanda.`,
    `Reia comanda: https://faguruldeaur.ro/miere`,
    ``,
    `Îți mulțumim pentru înțelegere!`,
  ].join("\n");

  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: data.customerEmail,
    replyTo: SHOP_REPLY_TO, // customer replies reach the business inbox
    subject: `Comanda ${data.orderId} a fost anulată`,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/email.test.ts`
Expected: PASS — all `sendShippingEmail` and `sendCancellationEmail` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts lib/email.test.ts
git commit -m "feat(email): sendCancellationEmail for cancelled orders"
```

---

### Task 2: `cancelOrder` server action

**Files:**
- Modify: `app/admin/comenzi/actions.ts` (add import + function)
- Test: `app/admin/comenzi/actions.test.ts` (add mock + describe block; update import)

- [ ] **Step 1: Write the failing tests**

In `app/admin/comenzi/actions.test.ts`:

(a) Add `sendCancellationEmailMock` to the `vi.hoisted` block so it becomes:

```ts
const {
  authMock,
  findUniqueMock,
  updateMock,
  sendShippingEmailMock,
  sendCancellationEmailMock,
  revalidateMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  sendShippingEmailMock: vi.fn(),
  sendCancellationEmailMock: vi.fn(),
  revalidateMock: vi.fn(),
}));
```

(b) Update the email mock to expose both senders:

```ts
vi.mock("@/lib/email", () => ({
  sendShippingEmail: sendShippingEmailMock,
  sendCancellationEmail: sendCancellationEmailMock,
}));
```

(c) Update the import of the actions:

```ts
import { markOrderShipped, cancelOrder } from "@/app/admin/comenzi/actions";
```

(d) Append this describe block at the end of the file:

```ts
describe("cancelOrder", () => {
  const cancellable = {
    orderNumber: "SB-1",
    customerEmail: "c@x.ro",
    customerFirstName: "Ana",
    status: "noua",
  };

  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    sendCancellationEmailMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(cancellable);
    sendCancellationEmailMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue({});
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(cancelOrder("SB-1")).rejects.toThrow(/unauthorized/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an already-shipped order", async () => {
    findUniqueMock.mockResolvedValue({ ...cancellable, status: "expediat" });
    const res = await cancelOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(sendCancellationEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an already-cancelled order", async () => {
    findUniqueMock.mockResolvedValue({ ...cancellable, status: "anulata" });
    const res = await cancelOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does NOT update when the email fails (all-or-nothing)", async () => {
    sendCancellationEmailMock.mockRejectedValue(new Error("smtp down"));
    const res = await cancelOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("emails then sets status anulata on success", async () => {
    const res = await cancelOrder("SB-1");
    expect(res).toEqual({ ok: true });
    expect(sendCancellationEmailMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledWith({
      where: { orderNumber: "SB-1" },
      data: { status: "anulata" },
    });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: FAIL — `cancelOrder` is not exported.

- [ ] **Step 3: Implement `cancelOrder`**

In `app/admin/comenzi/actions.ts`, update the email import:

```ts
import { sendShippingEmail, sendCancellationEmail } from "@/lib/email";
```

Then add at the end of the file:

```ts
/**
 * Cancel an order: email the customer, then (only if the email succeeded) set the
 * status to "anulata". ADMIN-only. Refuses orders already shipped or cancelled.
 */
export async function cancelOrder(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({ where: { orderNumber: orderId } });
  if (!order) {
    return { ok: false, error: "Comanda nu a fost găsită." };
  }
  if (order.status === "expediat" || order.status === "anulata") {
    return { ok: false, error: "Comanda nu mai poate fi anulată." };
  }

  // All-or-nothing: send the email first; if it fails, leave the order untouched.
  try {
    await sendCancellationEmail({
      orderId: order.orderNumber,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
    });
  } catch {
    return { ok: false, error: "Emailul nu a putut fi trimis. Încearcă din nou." };
  }

  await prisma.order.update({
    where: { orderNumber: orderId },
    data: { status: "anulata" },
  });
  revalidatePath("/admin/comenzi");
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: PASS — `markOrderShipped` and `cancelOrder` suites green.

- [ ] **Step 5: Commit**

```bash
git add app/admin/comenzi/actions.ts app/admin/comenzi/actions.test.ts
git commit -m "feat(admin): cancelOrder action (email + status anulata)"
```

---

### Task 3: `deleteOrder` server action

**Files:**
- Modify: `app/admin/comenzi/actions.ts` (add function)
- Test: `app/admin/comenzi/actions.test.ts` (add delete mock + describe; update import)

- [ ] **Step 1: Write the failing tests**

In `app/admin/comenzi/actions.test.ts`:

(a) Add `deleteMock` to the `vi.hoisted` block (alongside the others):

```ts
  deleteMock: vi.fn(),
```

so the hoisted object now also destructures `deleteMock` at the top:

```ts
const {
  authMock,
  findUniqueMock,
  updateMock,
  deleteMock,
  sendShippingEmailMock,
  sendCancellationEmailMock,
  revalidateMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  sendShippingEmailMock: vi.fn(),
  sendCancellationEmailMock: vi.fn(),
  revalidateMock: vi.fn(),
}));
```

(b) Add `delete` to the prisma mock:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: findUniqueMock, update: updateMock, delete: deleteMock } },
}));
```

(c) Update the actions import:

```ts
import { markOrderShipped, cancelOrder, deleteOrder } from "@/app/admin/comenzi/actions";
```

(d) Append this describe block at the end of the file:

```ts
describe("deleteOrder", () => {
  beforeEach(() => {
    authMock.mockReset();
    deleteMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    deleteMock.mockResolvedValue({});
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(deleteOrder("SB-1")).rejects.toThrow(/unauthorized/i);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes the order and revalidates on success", async () => {
    const res = await deleteOrder("SB-1");
    expect(res).toEqual({ ok: true });
    expect(deleteMock).toHaveBeenCalledWith({ where: { orderNumber: "SB-1" } });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });

  it("returns an error when the delete throws (missing row)", async () => {
    deleteMock.mockRejectedValue(new Error("P2025"));
    const res = await deleteOrder("SB-1");
    expect(res).toEqual({ ok: false, error: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: FAIL — `deleteOrder` is not exported.

- [ ] **Step 3: Implement `deleteOrder`**

In `app/admin/comenzi/actions.ts`, add at the end of the file:

```ts
/**
 * Permanently delete an order. ADMIN-only, no email. Orders have no child rows
 * (items are JSON; the User relation is onDelete: SetNull), so one delete suffices.
 * Prisma throws P2025 if the row is missing — caught and surfaced as an error.
 */
export async function deleteOrder(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  try {
    await prisma.order.delete({ where: { orderNumber: orderId } });
  } catch {
    return { ok: false, error: "Comanda nu a putut fi ștearsă." };
  }
  revalidatePath("/admin/comenzi");
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: PASS — all three suites (`markOrderShipped`, `cancelOrder`, `deleteOrder`) green.

- [ ] **Step 5: Commit**

```bash
git add app/admin/comenzi/actions.ts app/admin/comenzi/actions.test.ts
git commit -m "feat(admin): deleteOrder action (hard delete)"
```

---

### Task 4: `OrderActionsCell` UI + page wiring

**Files:**
- Create: `app/admin/comenzi/OrderActionsCell.tsx`
- Delete: `app/admin/comenzi/ShipOrderCell.tsx`
- Modify: `app/admin/comenzi/page.tsx:5` (import) and `:69` (JSX tag)

No unit test — the Vitest environment is node (no DOM), so client components aren't unit-tested here. Verified via `tsc` + `next build` + manual check.

- [ ] **Step 1: Create `OrderActionsCell.tsx`**

Create `app/admin/comenzi/OrderActionsCell.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { markOrderShipped, cancelOrder, deleteOrder } from "./actions";

type Mode = "idle" | "ship" | "confirm-cancel" | "confirm-delete";
type ActionResult = { ok: true } | { ok: false; error: string };

/** Per-row controls in the orders table: Expediat (with AWB form) and Anulare are
 *  shown only while the order is neither shipped nor cancelled; Șterge is always
 *  available. Each destructive action asks for inline confirmation first. */
export function OrderActionsCell({
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
  const [mode, setMode] = useState<Mode>("idle");
  const [city, setCity] = useState("");
  const [awbValue, setAwbValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const shipped = status === "expediat" || !!awb;
  const cancelled = status === "anulata";

  const run = (action: () => Promise<ActionResult>) => {
    setError("");
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      // On success revalidatePath re-renders the row into its new state.
    });
  };

  if (mode === "ship") {
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
            onClick={() => run(() => markOrderShipped(orderId, city, awbValue))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-gold-400/20 text-gold-300 hover:bg-gold-400/30 disabled:opacity-50"
          >
            {pending ? "Se trimite…" : "Trimite"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
          >
            Renunță
          </button>
        </div>
        {error && <p className="text-error text-[11px]">{error}</p>}
      </div>
    );
  }

  if (mode === "confirm-cancel") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Sigur anulezi comanda?</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => run(() => cancelOrder(orderId))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-error/15 text-error hover:bg-error/25 disabled:opacity-50"
          >
            {pending ? "Se anulează…" : "Da, anulează"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
          >
            Nu
          </button>
        </div>
        {error && <p className="text-error text-[11px]">{error}</p>}
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Ștergi definitiv comanda?</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => run(() => deleteOrder(orderId))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-error/15 text-error hover:bg-error/25 disabled:opacity-50"
          >
            {pending ? "Se șterge…" : "Da, șterge"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs text-text-muted hover:text-gold-300"
          >
            Nu
          </button>
        </div>
        {error && <p className="text-error text-[11px]">{error}</p>}
      </div>
    );
  }

  // idle: state-specific ship/cancel content + always-present delete.
  return (
    <div className="flex items-center gap-2">
      {cancelled ? (
        <span className="text-text-muted text-xs">Anulată</span>
      ) : shipped ? (
        <span className="text-text-muted text-xs whitespace-nowrap">
          AWB {awb ?? "—"}
          {courierCity ? ` · ${courierCity}` : ""}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMode("ship")}
            className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors"
          >
            Expediat
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-cancel")}
            className="px-3 py-1 rounded-sm text-xs font-medium bg-error/10 text-error hover:bg-error/20 transition-colors"
          >
            Anulare
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => setMode("confirm-delete")}
        className="px-3 py-1 rounded-sm text-xs font-medium text-error/80 hover:bg-error/10 transition-colors"
      >
        Șterge
      </button>
      {error && <p className="text-error text-[11px]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Update `page.tsx` import and JSX tag**

In `app/admin/comenzi/page.tsx`, change the import (line 5):

```ts
import { OrderActionsCell } from "./OrderActionsCell";
```

And the JSX usage (line 69) — rename the tag, keep the props:

```tsx
                      <OrderActionsCell
                        orderId={o.orderNumber}
                        status={o.status}
                        awb={o.awb}
                        courierCity={o.courierCity}
                      />
```

- [ ] **Step 3: Delete the old cell**

```bash
git rm app/admin/comenzi/ShipOrderCell.tsx
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output (clean).

Run: `npx next build`
Expected: build succeeds; no errors referencing `ShipOrderCell` or `OrderActionsCell`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in as ADMIN, open `/admin/comenzi`. Confirm on a fresh (unshipped) order:
- "Expediat", "Anulare", "Șterge" buttons show side by side.
- "Anulare" → "Sigur anulezi comanda? Da, anulează / Nu"; "Da" emails the customer and the row shows "Anulată".
- "Șterge" → "Ștergi definitiv comanda? Da, șterge / Nu"; "Da" removes the row.
- On a shipped order, only the AWB text + "Șterge" show; on a cancelled order, "Anulată" + "Șterge".

- [ ] **Step 6: Commit**

```bash
git add app/admin/comenzi/OrderActionsCell.tsx app/admin/comenzi/page.tsx
git commit -m "feat(admin): OrderActionsCell with Anulare + Șterge buttons"
```

---

## Self-review

**Spec coverage:**
- Cancel email (fixed message, from shop, replyTo shop) → Task 1 ✓
- `cancelOrder`: ADMIN-only, all-or-nothing, guard shipped/cancelled, status "anulata", revalidate → Task 2 ✓
- `deleteOrder`: ADMIN-only, hard delete, no email, revalidate → Task 3 ✓
- Buttons Anulare (only unshipped/uncancelled) + Șterge (always), inline confirmation, rename to OrderActionsCell, page import → Task 4 ✓
- Tests for email + both actions → Tasks 1–3 ✓
- Out of scope (refund, archive, analytics) → no tasks, as intended ✓

**Placeholders:** none — every code step has full code.

**Type consistency:** `cancelOrder`/`deleteOrder`/`markOrderShipped` all return `{ ok: true } | { ok: false; error: string }`, assignable to the cell's `ActionResult` and `run`'s parameter type. Mock names (`sendCancellationEmailMock`, `deleteMock`) are consistent across Tasks 2–3. Prisma mock gains `delete` in Task 3 alongside `findUnique`/`update`.
