# Buton „Confirmare comandă" — Plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaugă un buton „Confirmare" în panoul admin de comenzi care trimite clientului un email de confirmare și trece comanda pe statusul „În procesare".

**Architecture:** Trei straturi, după tiparul deja existent al butoanelor Expediat/Anulare: o funcție de email (`sendConfirmationEmail`), o server action ADMIN-only cu logică totul-sau-nimic (`confirmOrder`), și un mod nou în state machine-ul componentei client `OrderActionsCell`. Se refolosește statusul existent `in_procesare`.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma (SQLite), Resend (email), Vitest (mediu node, fără jsdom), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-16-confirmare-comanda-design.md`

---

## Context pentru implementator

Panoul de comenzi are deja trei acțiuni per rând. Cele relevante ca model:

- `lib/email.ts` conține `sendCancellationEmail` (modelul pentru noul email) —
  trimite de la `MAIL_FROM`, cu `replyTo: SHOP_REPLY_TO`, folosește helperul
  `esc()` pentru escaping HTML, și aruncă `Error` dacă Resend întoarce eroare.
  `getClient()`, `MAIL_FROM`, `SHOP_REPLY_TO` și `esc` există deja în fișier.
- `app/admin/comenzi/actions.ts` conține `cancelOrder` (modelul pentru noua
  acțiune) — `auth()` ADMIN-only, `findUnique`, guard de status, trimite emailul
  întâi (totul-sau-nimic), apoi `prisma.order.update` + `revalidatePath`.
- `app/admin/comenzi/OrderActionsCell.tsx` este componenta client cu state
  machine (`Mode`), helperul `goto()` (resetează eroarea/formularul) și helperul
  `run()` (rulează acțiunea într-o tranziție, setează eroarea sau revine la idle).
- Statusul `in_procesare` („În procesare") există deja în `ORDER_STATUS_LABELS`
  din `lib/utils.ts`. NU adăuga un status nou.

Rulează toată suita cu `npx vitest run` și typecheck cu `npx tsc --noEmit`.

---

## Task 1: Emailul de confirmare (`sendConfirmationEmail`)

**Files:**
- Modify: `lib/email.ts` (adaugă interfața + funcția la finalul secțiunii de emailuri; modelul e `sendCancellationEmail`, liniile ~230-278)
- Test: `lib/email.test.ts` (adaugă un bloc `describe`)

- [ ] **Step 1: Scrie testele care pică**

Adaugă la finalul lui `lib/email.test.ts`, și extinde importul din linia 12 la
`import { sendShippingEmail, sendCancellationEmail, sendConfirmationEmail } from "@/lib/email";`:

```ts
describe("sendConfirmationEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ error: null });
  });

  it("sends to the customer, replying to the shop inbox, with the processing message", async () => {
    await sendConfirmationEmail({
      orderId: "SB-7",
      customerEmail: "client@example.com",
      customerFirstName: "Ana",
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("client@example.com");
    expect(arg.replyTo).toBe("faguruldeaur@gmail.com");
    expect(arg.subject).toContain("SB-7");
    expect(arg.text).toContain("în curs de procesare");
    expect(arg.html).toContain("în curs de procesare");
  });

  it("escapes HTML in the customer name", async () => {
    await sendConfirmationEmail({
      orderId: "SB-8",
      customerEmail: "x@y.z",
      customerFirstName: "<b>x</b>",
    });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ error: { name: "bad", message: "nope" } });
    await expect(
      sendConfirmationEmail({ orderId: "SB-9", customerEmail: "x@y.z", customerFirstName: "A" })
    ).rejects.toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Rulează testele ca să confirmi că pică**

Run: `npx vitest run lib/email.test.ts`
Expected: FAIL — `sendConfirmationEmail` nu e exportat (`No "sendConfirmationEmail" export is defined`).

- [ ] **Step 3: Implementează funcția**

Adaugă în `lib/email.ts` imediat după `sendCancellationEmail` (după linia ~278):

```ts
export interface ConfirmationEmailData {
  orderId: string;
  customerEmail: string;
  customerFirstName: string;
}

/**
 * Tells the CUSTOMER their order was received and is being processed. Like
 * sendCancellationEmail, it goes to the customer from the shop sender (MAIL_FROM)
 * with replies routed to the shop inbox. Throws on failure so the caller can
 * abort before persisting.
 */
export async function sendConfirmationEmail(data: ConfirmationEmailData): Promise<void> {
  const name = esc(data.customerFirstName);
  const orderId = esc(data.orderId);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
      <h2 style="color:#B5700A">Comanda ta a fost primită</h2>
      <p>Salut ${name},</p>
      <p>
        Am primit comanda <strong>${orderId}</strong> și este în curs de procesare.
        Veți primi un email cu AWB-ul când aceasta va fi expediată.
      </p>
      <p style="color:#888">Vă mulțumim! 🐝</p>
    </div>`;

  const text = [
    `Comanda ta a fost primită`,
    ``,
    `Salut ${data.customerFirstName},`,
    `Am primit comanda ${data.orderId} și este în curs de procesare. Veți primi un email cu AWB-ul când aceasta va fi expediată.`,
    ``,
    `Vă mulțumim!`,
  ].join("\n");

  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: data.customerEmail,
    replyTo: SHOP_REPLY_TO, // customer replies reach the business inbox
    subject: `Comanda ${data.orderId} a fost primită`,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}
```

- [ ] **Step 4: Rulează testele ca să confirmi că trec**

Run: `npx vitest run lib/email.test.ts`
Expected: PASS — toate testele (existente + cele 3 noi).

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts lib/email.test.ts
git commit -m "feat(email): add order confirmation email"
```

---

## Task 2: Server action (`confirmOrder`)

**Files:**
- Modify: `app/admin/comenzi/actions.ts` (extinde importul de email din linia 7; adaugă funcția după `cancelOrder`, liniile ~64-97)
- Test: `app/admin/comenzi/actions.test.ts` (adaugă mock + bloc `describe`)

- [ ] **Step 1: Scrie testele care pică**

În `app/admin/comenzi/actions.test.ts`:

(a) Adaugă `sendConfirmationEmailMock` la obiectul `vi.hoisted` (liniile 3-19),
alături de `sendCancellationEmailMock`:

```ts
  sendConfirmationEmailMock: vi.fn(),
```

(b) Adaugă-l în factory-ul mock-ului de email (liniile 24-27):

```ts
vi.mock("@/lib/email", () => ({
  sendShippingEmail: sendShippingEmailMock,
  sendCancellationEmail: sendCancellationEmailMock,
  sendConfirmationEmail: sendConfirmationEmailMock,
}));
```

(c) Extinde importul (linia 30):

```ts
import { markOrderShipped, confirmOrder, cancelOrder, deleteOrder } from "@/app/admin/comenzi/actions";
```

(d) Adaugă blocul `describe` la finalul fișierului:

```ts
describe("confirmOrder", () => {
  const confirmable = {
    orderNumber: "SB-1",
    customerEmail: "c@x.ro",
    customerFirstName: "Ana",
    status: "noua",
  };

  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    sendConfirmationEmailMock.mockReset();
    revalidateMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(confirmable);
    sendConfirmationEmailMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue({});
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(confirmOrder("SB-1")).rejects.toThrow(/unauthorized/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an order that is not new", async () => {
    findUniqueMock.mockResolvedValue({ ...confirmable, status: "in_procesare" });
    const res = await confirmOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(sendConfirmationEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns an error when the order is missing", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await confirmOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(sendConfirmationEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does NOT update when the email fails (all-or-nothing)", async () => {
    sendConfirmationEmailMock.mockRejectedValue(new Error("smtp down"));
    const res = await confirmOrder("SB-1");
    expect(res.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("emails then sets status in_procesare on success", async () => {
    const res = await confirmOrder("SB-1");
    expect(res).toEqual({ ok: true });
    expect(sendConfirmationEmailMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledWith({
      where: { orderNumber: "SB-1" },
      data: { status: "in_procesare" },
    });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/comenzi");
  });
});
```

- [ ] **Step 2: Rulează testele ca să confirmi că pică**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: FAIL — `confirmOrder` nu e exportat.

- [ ] **Step 3: Implementează acțiunea**

(a) Extinde importul de email din `app/admin/comenzi/actions.ts` (linia 7):

```ts
import { sendShippingEmail, sendCancellationEmail, sendConfirmationEmail } from "@/lib/email";
```

(b) Adaugă funcția imediat după `cancelOrder` (după linia ~97):

```ts
/**
 * Confirm an order: email the customer that it was received and is being
 * processed, then (only if the email succeeded) set the status to "in_procesare".
 * ADMIN-only. Accepts only brand-new orders; anything already confirmed, shipped
 * or cancelled is refused.
 */
export async function confirmOrder(
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
  if (order.status !== "noua") {
    return { ok: false, error: "Comanda a fost deja confirmată sau procesată." };
  }

  // All-or-nothing: send the email first; if it fails, leave the order untouched.
  try {
    await sendConfirmationEmail({
      orderId: order.orderNumber,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
    });
  } catch {
    return { ok: false, error: "Emailul nu a putut fi trimis. Încearcă din nou." };
  }

  await prisma.order.update({
    where: { orderNumber: orderId },
    data: { status: "in_procesare" },
  });
  revalidatePath("/admin/comenzi");
  return { ok: true };
}
```

- [ ] **Step 4: Rulează testele ca să confirmi că trec**

Run: `npx vitest run app/admin/comenzi/actions.test.ts`
Expected: PASS — toate testele (existente + cele 5 noi).

- [ ] **Step 5: Commit**

```bash
git add app/admin/comenzi/actions.ts app/admin/comenzi/actions.test.ts
git commit -m "feat(admin): add confirmOrder server action"
```

---

## Task 3: Butonul în UI (`OrderActionsCell`)

**Files:**
- Modify: `app/admin/comenzi/OrderActionsCell.tsx`

Nu există test unitar pentru componenta client (mediul Vitest e `node`, fără
jsdom — la fel ca pentru celelalte butoane). Verificarea se face prin `tsc`,
`build` și suita completă.

- [ ] **Step 1: Extinde importul acțiunilor (linia 4)**

```ts
import { markOrderShipped, confirmOrder, cancelOrder, deleteOrder } from "./actions";
```

- [ ] **Step 2: Adaugă modul nou la tipul `Mode` (linia 6)**

```ts
type Mode = "idle" | "ship" | "confirm-order" | "confirm-cancel" | "confirm-delete";
```

- [ ] **Step 3: Derivă `isNew` lângă `shipped`/`cancelled` (după linia 30)**

Sub `const cancelled = status === "anulata";` adaugă:

```ts
  const isNew = status === "noua";
```

- [ ] **Step 4: Adaugă branch-ul `confirm-order`**

Inserează acest bloc chiar înainte de `if (mode === "confirm-cancel") {` (linia 93):

```tsx
  if (mode === "confirm-order") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Trimit confirmarea către client?</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => run(() => confirmOrder(orderId))}
            disabled={pending}
            className="px-2 py-1 rounded-sm text-xs font-medium bg-gold-400/20 text-gold-300 hover:bg-gold-400/30 disabled:opacity-50"
          >
            {pending ? "Se trimite…" : "Da, confirmă"}
          </button>
          <button
            type="button"
            onClick={() => goto("idle")}
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
```

- [ ] **Step 5: Adaugă butonul Confirmare în ramura activă din `idle`**

În branch-ul `idle`, ramura `else` (comandă activă, liniile ~157-173), adaugă
butonul Confirmare ca **prim** element al fragmentului, vizibil doar cât `isNew`.
Fragmentul devine:

```tsx
        <>
          {isNew && (
            <button
              type="button"
              onClick={() => goto("confirm-order")}
              className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors"
            >
              Confirmare
            </button>
          )}
          <button
            type="button"
            onClick={() => goto("ship")}
            className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors"
          >
            Expediat
          </button>
          <button
            type="button"
            onClick={() => goto("confirm-cancel")}
            className="px-3 py-1 rounded-sm text-xs font-medium bg-error/10 text-error hover:bg-error/20 transition-colors"
          >
            Anulare
          </button>
        </>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: fără erori.

- [ ] **Step 7: Suita completă + build**

Run: `npx vitest run && npx next build`
Expected: toate testele trec; build reușește.

- [ ] **Step 8: Verificare manuală (opțional, dev server)**

Run: `npm run dev`, apoi în `/admin/comenzi` cu un cont ADMIN:
- O comandă cu status „Nouă" arată butoanele: **Confirmare · Expediat · Anulare · Șterge**.
- Click „Confirmare" → „Trimit confirmarea către client?" cu **Da, confirmă** / **Nu**.
- După „Da, confirmă": clientul primește mailul, rândul trece pe „În procesare",
  iar butonul Confirmare dispare (Expediat + Anulare rămân).
- O comandă expediată/anulată nu arată Confirmare.

- [ ] **Step 9: Commit**

```bash
git add app/admin/comenzi/OrderActionsCell.tsx
git commit -m "feat(admin): add Confirmare button to order actions"
```

---

## Verificare finală

- [ ] `npx vitest run` — toată suita verde (105 existente + 8 noi = 113).
- [ ] `npx tsc --noEmit` — curat.
- [ ] `npx next build` — reușește.
- [ ] Push pe `main` (deploy automat Vercel) — doar după confirmarea utilizatorului.
