# Anulare + Ștergere comandă din panoul admin — Design

**Data:** 2026-07-15
**Autor:** brainstorming cu proprietarul magazinului

## Scop

Două acțiuni noi pe fiecare rând din tabelul de comenzi din admin, lângă butonul
existent **„Expediat"**:

1. **„Anulare"** — trimite clientului un email fix de anulare și trece comanda în
   statusul „Anulată".
2. **„Șterge"** — șterge comanda definitiv din panou și din baza de date (fără
   email).

Feature-ul oglindește fluxul „Expediat"
(vezi `docs/superpowers/specs/2026-07-15-flux-expediere-awb-design.md`).

## Decizii (confirmate cu proprietarul)

### Anulare
1. **Status la anulare:** comanda devine `status = "anulata"` (eticheta există deja
   în `ORDER_STATUS_LABELS`).
2. **Mail eșuat:** *totul sau nimic* — dacă emailul nu pleacă, comanda rămâne
   neatinsă și se afișează eroare (ca la Expediat).
3. **Disponibilitate:** butonul apare doar pe comenzi **neexpediate și neanulate**.
4. **Confirmare:** confirmare inline („Sigur? Da / Nu") înainte de a trimite.

### Ștergere
5. **Disponibilitate:** butonul „Șterge" apare pe **orice comandă**, indiferent de
   status (inclusiv expediate/anulate).
6. **Efect:** șterge rândul din baza de date (`prisma.order.delete`). Comenzile nu
   au tabele copil — `items` e un câmp JSON, iar relația cu User e `onDelete:
   SetNull` — deci nu e nevoie de cascade.
7. **Fără email.**
8. **Confirmare:** confirmare inline („Ștergi definitiv? Da / Nu"), buton roșu.
9. **Ireversibil:** ștergerea e hard-delete, nu arhivare.

## Mesajul emailului (text fix)

> Ne pare rău, dar comanda dumneavoastră nu a putut fi procesată și a fost
> anulată. Vă rugăm să refaceți comanda.

Numărul comenzii apare în subiect și în corp. Fără câmpuri variabile introduse de
admin (spre deosebire de Expediat, care cere oraș + AWB).

## Arhitectură — 5 unități

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

### 3. `app/admin/comenzi/actions.ts` → `deleteOrder(orderId)`

Semnătură: `deleteOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }>`.

Pași:

1. `auth()`; dacă `session?.user?.role !== "ADMIN"` → `throw new Error("Unauthorized")`.
2. `try { await prisma.order.delete({ where: { orderNumber: orderId } }) }`
   `catch → { ok: false, error: "Comanda nu a putut fi ștearsă." }`
   (Prisma aruncă `P2025` dacă rândul nu există — prins de catch).
3. `revalidatePath("/admin/comenzi")`.
4. `{ ok: true }`.

Fără email, fără guard de status — ștergerea e permisă pe orice comandă.

### 4. `app/admin/comenzi/ShipOrderCell.tsx` → redenumit `OrderActionsCell.tsx`

Celula face acum 3 acțiuni, deci se redenumește pentru claritate (se actualizează
și importul din `page.tsx`). Structura: o parte **specifică stării** (Expediat /
Anulare / read-only) plus un buton **„Șterge" mereu prezent**.

Partea specifică stării (verificată în ordine):

1. `status === "anulata"` → text read-only **„Anulată"**.
2. `status === "expediat" || awb` → AWB read-only (comportamentul actual).
3. altfel → **„Expediat"** (deschide formularul oraș + AWB existent) + **„Anulare"**
   (roșu; click → confirm inline **„Sigur? Da / Nu"** → `cancelOrder`).

Butonul **„Șterge"** (mereu vizibil, indiferent de status):
- stil roșu, distinct de „Anulare".
- Click → confirm inline **„Ștergi definitiv? Da / Nu"**.
- „Da" → `startTransition(() => deleteOrder(orderId))`; „Nu" revine.
- Eroarea din rezultat se afișează sub butoane (`text-error text-[11px]`).

Cele trei fluxuri interactive (form AWB, confirm anulare, confirm ștergere) sunt
stări separate exclusive — deschiderea uneia o închide pe celelalte.

### 5. `app/admin/comenzi/page.tsx`

Nicio coloană nouă. Se schimbă doar importul: `ShipOrderCell` → `OrderActionsCell`.
Props-urile rămân aceleași (`status`, `awb`, `courierCity`, `orderId`).

## Flux de date

**Anulare:**
```
Admin → „Anulare" → „Sigur? Da/Nu" → „Da"
      → cancelOrder(orderId)
          → sendCancellationEmail  (dacă eșuează: stop, eroare inline)
          → update status = "anulata"
          → revalidatePath
      → celula arată „Anulată"
```

**Ștergere:**
```
Admin → „Șterge" → „Ștergi definitiv? Da/Nu" → „Da"
      → deleteOrder(orderId)
          → prisma.order.delete
          → revalidatePath
      → rândul dispare din tabel
```

## Erori

- **Mail anulare eșuat:** `{ ok: false }`, comanda neatinsă, eroare inline.
- **Comandă deja expediată/anulată (la anulare):** guard server → `{ ok: false }`.
- **Ștergere: comandă inexistentă:** Prisma aruncă → catch → `{ ok: false }`.
- **Non-admin:** `throw` la ambele acțiuni.

## Teste

**`lib/email.test.ts`** (adaugă la suita existentă):
- `sendCancellationEmail` trimite către client, `replyTo` = inboxul shop-ului,
  subiectul conține numărul comenzii, corpul conține mesajul fix de anulare.
- Escape HTML în `customerFirstName`.
- Aruncă când Resend întoarce eroare.

**`app/admin/comenzi/actions.test.ts`** (adaugă la suita existentă):
- `cancelOrder`: non-admin → aruncă; deja expediată → `{ ok:false }` fără email/update;
  deja anulată → `{ ok:false }`; mail eșuat → `{ ok:false }` fără update (all-or-nothing);
  succes → email trimis, `status: "anulata"`, `revalidatePath` apelat.
- `deleteOrder`: non-admin → aruncă; succes → `prisma.order.delete` apelat cu
  `orderNumber`, `revalidatePath` apelat, `{ ok:true }`; delete aruncă (rând
  inexistent) → `{ ok:false }`.

## În afara scopului

- **Refund automat:** anularea/ștergerea unei comenzi plătite cu cardul **nu**
  declanșează refund prin Netopia. Refund-ul rămâne manual. Temă viitoare.
- **Arhivare / soft-delete:** ștergerea e hard-delete definitiv, nu arhivare.
- **Refire evenimente analytics** (ex. eveniment de anulare în Meta/GA4) — nu e cerut.
