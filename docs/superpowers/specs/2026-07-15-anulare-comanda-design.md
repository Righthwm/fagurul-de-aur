# Anulare comandă din panoul admin — Design

**Data:** 2026-07-15
**Autor:** brainstorming cu proprietarul magazinului

## Scop

Un buton **„Anulare"** lângă butonul **„Expediat"** în tabelul de comenzi din admin.
La anulare: se trimite clientului un email fix de anulare și comanda trece în
statusul „Anulată". Feature-ul oglindește aproape identic fluxul „Expediat"
(vezi `docs/superpowers/specs/2026-07-15-flux-expediere-awb-design.md`).

## Decizii (confirmate cu proprietarul)

1. **Status la anulare:** comanda devine `status = "anulata"` (eticheta există deja
   în `ORDER_STATUS_LABELS`).
2. **Mail eșuat:** *totul sau nimic* — dacă emailul nu pleacă, comanda rămâne
   neatinsă și se afișează eroare (ca la Expediat).
3. **Disponibilitate:** butonul apare doar pe comenzi **neexpediate și neanulate**.
4. **Confirmare:** confirmare inline („Sigur? Da / Nu") înainte de a trimite.

## Mesajul emailului (text fix)

> Ne pare rău, dar comanda dumneavoastră nu a putut fi procesată și a fost
> anulată. Vă rugăm să refaceți comanda.

Numărul comenzii apare în subiect și în corp. Fără câmpuri variabile introduse de
admin (spre deosebire de Expediat, care cere oraș + AWB).

## Arhitectură — 4 unități

### 1. `lib/email.ts` → `sendCancellationEmail(data)`

Copie fidelă a `sendShippingEmail`, fără câmpurile AWB.

```ts
interface CancellationEmailData {
  orderId: string;
  customerEmail: string;
  customerFirstName: string;
}
```

- **To:** `data.customerEmail`
- **From:** `MAIL_FROM`
- **replyTo:** `SHOP_REPLY_TO` (constanta existentă, `faguruldeaur@gmail.com`)
- **Subiect:** conține `data.orderId` (ex. „Comanda SB-123 a fost anulată").
- **Corp (text + HTML):** salut cu `customerFirstName` (escape HTML în HTML) +
  mesajul fix de mai sus.
- **Aruncă** dacă Resend întoarce eroare (la fel ca `sendShippingEmail`).

### 2. `app/admin/comenzi/actions.ts` → `cancelOrder(orderId)`

Semnătură: `cancelOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }>`.

Pași (oglindește `markOrderShipped`):

1. `auth()`; dacă `session?.user?.role !== "ADMIN"` → `throw new Error("Unauthorized")`.
2. Găsește comanda după `orderNumber`; lipsă → `{ ok: false, error: "Comanda nu a fost găsită." }`.
3. **Guard defensiv:** dacă `order.status === "expediat"` sau `order.status === "anulata"`
   → `{ ok: false, error: "Comanda nu mai poate fi anulată." }` (butonul e ascuns
   oricum, dar serverul reverifică).
4. **Totul sau nimic:** `try { await sendCancellationEmail({...}) } catch`
   → `{ ok: false, error: "Emailul nu a putut fi trimis. Încearcă din nou." }`
   (comanda rămâne neatinsă).
5. `prisma.order.update({ where: { orderNumber }, data: { status: "anulata" } })`.
6. `revalidatePath("/admin/comenzi")`.
7. `{ ok: true }`.

### 3. `app/admin/comenzi/ShipOrderCell.tsx` (extins)

Celula de acțiuni per rând capătă trei stări (verificate în ordine):

1. `status === "anulata"` → text read-only **„Anulată"** (nicio acțiune).
2. `status === "expediat" || awb` → AWB read-only (comportamentul actual).
3. altfel → **două butoane** unul lângă altul:
   - **„Expediat"** — deschide formularul inline oraș + AWB existent (neschimbat).
   - **„Anulare"** — stil roșu (`text-error` / fundal roșu subtil). Click →
     stare de confirmare inline **„Sigur? Da / Nu"**. „Da" pornește
     `startTransition(() => cancelOrder(orderId))`; „Nu" revine la butoane.
     Eroarea din rezultat se afișează sub butoane (`text-error text-[11px]`).

Cele două fluxuri (form AWB și confirm anulare) sunt stări separate în aceeași
componentă, exclusive între ele — deschiderea uneia o închide pe cealaltă.

### 4. `app/admin/comenzi/page.tsx`

Nicio coloană nouă. Celula de acțiuni existentă primește deja `status`, `awb`,
`courierCity` — nu se schimbă props-urile.

## Flux de date

```
Admin → click „Anulare" → „Sigur? Da/Nu" → „Da"
      → cancelOrder(orderId)
          → sendCancellationEmail  (dacă eșuează: stop, eroare inline)
          → update status = "anulata"
          → revalidatePath
      → tabelul se re-randează → celula arată „Anulată"
```

## Erori

- **Mail eșuat:** `{ ok: false }`, comanda neatinsă, eroare inline. Adminul poate
  reîncerca.
- **Comandă deja expediată/anulată:** guard server → `{ ok: false }` cu mesaj.
- **Non-admin:** `throw` (nu ajunge la UI în mod normal).

## Teste

**`lib/email.test.ts`** (adaugă la suita existentă):
- `sendCancellationEmail` trimite către client, `replyTo` = inboxul shop-ului,
  subiectul conține numărul comenzii, corpul conține mesajul fix de anulare.
- Escape HTML în `customerFirstName`.
- Aruncă când Resend întoarce eroare.

**`app/admin/comenzi/actions.test.ts`** (adaugă la suita existentă):
- Non-admin → aruncă „Unauthorized".
- Comandă deja expediată → `{ ok: false }`, fără email, fără update.
- Comandă deja anulată → `{ ok: false }`, fără update.
- Mail eșuat → `{ ok: false }`, statusul rămâne neschimbat (all-or-nothing).
- Succes → email trimis, `status: "anulata"`, `revalidatePath` apelat.

## În afara scopului

- **Refund automat:** anularea unei comenzi plătite cu cardul **nu** declanșează
  refund prin Netopia — doar trimite mailul + setează statusul. Refund-ul rămâne
  manual. Temă viitoare, conform deciziei „deocamdată atât".
- **Refire evenimente analytics** (ex. un eveniment de anulare în Meta/GA4) — nu e
  cerut.
