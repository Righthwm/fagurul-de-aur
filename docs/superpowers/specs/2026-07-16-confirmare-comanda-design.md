# Buton „Confirmare comandă" în panoul admin — Design

**Data:** 2026-07-16
**Status:** Aprobat, gata de plan de implementare

## Scop

Adaugă un buton **Confirmare** în rândul fiecărei comenzi din panoul admin
(`/admin/comenzi`). La apăsare, trimite clientului un email fix care confirmă
primirea comenzii și anunță că urmează un email cu AWB-ul la expediere. Comanda
trece pe statusul „În procesare".

Butonul e primul pas din fluxul de administrare a unei comenzi:
**Confirmare → Expediat → (opțional) Anulare / Șterge**.

## Context

Panoul de comenzi are deja trei acțiuni per rând, implementate în
[`app/admin/comenzi/OrderActionsCell.tsx`](../../../app/admin/comenzi/OrderActionsCell.tsx)
și [`app/admin/comenzi/actions.ts`](../../../app/admin/comenzi/actions.ts):

- **Expediat** — formular AWB + oraș, trimite email de expediere, setează status `expediat`.
- **Anulare** — confirmare inline, trimite email de anulare, setează status `anulata`.
- **Șterge** — confirmare inline, șterge definitiv comanda (fără email).

Toate acțiunile sunt `ADMIN`-only și folosesc tiparul **totul sau nimic**:
trimit emailul întâi și persistă schimbarea de status doar dacă emailul a reușit.

Statusul `in_procesare` („În procesare") **există deja** în
`ORDER_STATUS_LABELS` din [`lib/utils.ts`](../../../lib/utils.ts) și se
potrivește exact cu textul mailului („este în curs de procesare"). Nu e nevoie
de un status nou.

## Decizii (confirmate cu clientul)

| Întrebare | Decizie |
|---|---|
| Status după confirmare | Devine `in_procesare` („În procesare") |
| Vizibilitatea butonului | Doar cât `status === "noua"`; dispare după confirmare |
| Declanșare | Confirmare inline („Trimit confirmarea?") — Da / Nu |
| Eșec email | Totul sau nimic (statusul nu se schimbă dacă mailul eșuează) |

## Componente

### 1. Email — `sendConfirmationEmail` (`lib/email.ts`)

Funcție nouă, modelată pe `sendCancellationEmail`:

- **Input:** `{ orderId, customerEmail, customerFirstName }` (interfață nouă
  `ConfirmationEmailData`, identică structural cu `CancellationEmailData`).
- **Expeditor / reply:** `MAIL_FROM`, cu `replyTo: SHOP_REPLY_TO` (răspunsurile
  clientului ajung în inbox-ul magazinului) — la fel ca la expediere/anulare.
- **Subiect:** `Comanda ${orderId} a fost primită`.
- **Comportament la eroare:** aruncă `Error` dacă Resend întoarce eroare, ca
  apelantul să poată abandona înainte de a persista statusul.
- **Escaping:** `customerFirstName` și `orderId` trec prin `esc()` în HTML.

**Conținut (mesajul cerut de client):**

> Am primit comanda dumneavoastră și este în curs de procesare. Veți primi un
> email cu AWB-ul când aceasta va fi expediată. Vă mulțumim.

Variantele HTML și text urmează structura vizuală a `sendCancellationEmail`
(titlu colorat `#B5700A`, salut „Salut {prenume}," corpul de mai sus, semnătura
prietenoasă cu 🐝). Nu conține link „Reia comanda" (spre deosebire de anulare).

### 2. Server action — `confirmOrder` (`app/admin/comenzi/actions.ts`)

```
confirmOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }>
```

Modelată pe `cancelOrder`:

1. `auth()` → dacă `session.user.role !== "ADMIN"`, aruncă `Error("Unauthorized")`.
2. `prisma.order.findUnique({ where: { orderNumber: orderId } })`; dacă lipsește →
   `{ ok: false, error: "Comanda nu a fost găsită." }`.
3. **Guard de precondiție:** dacă `order.status !== "noua"` →
   `{ ok: false, error: "Comanda a fost deja confirmată sau procesată." }`.
   (Butonul apare doar la comenzi noi, dar guardul apără și împotriva unui
   dublu-click / stare învechită.)
4. **Totul sau nimic:** `try { await sendConfirmationEmail({ orderId: order.orderNumber,
   customerEmail: order.customerEmail, customerFirstName: order.customerFirstName }) }
   catch { return { ok: false, error: "Emailul nu a putut fi trimis. Încearcă din nou." } }`.
5. `prisma.order.update({ where: { orderNumber: orderId }, data: { status: "in_procesare" } })`.
6. `revalidatePath("/admin/comenzi")`.
7. `return { ok: true }`.

### 3. UI — `OrderActionsCell.tsx`

Extinde state machine-ul existent:

- **Mode nou:** `"confirm-order"` adăugat la tipul `Mode`
  (`"idle" | "ship" | "confirm-order" | "confirm-cancel" | "confirm-delete"`).
- **Import:** adaugă `confirmOrder` la importul din `./actions`.
- **Derivare stare:** `const isNew = status === "noua";` (folosit doar pentru
  Confirmare — Expediat/Anulare rămân pe condiția existentă `!shipped && !cancelled`).

**Branch `confirm-order`** (nou, înainte de `confirm-cancel`), analog cu acesta:

- Text: „Trimit confirmarea către client?"
- Buton primar: `Da, confirmă` (în progres: „Se trimite…"), stil pozitiv
  gold (`bg-gold-400/20 text-gold-300 hover:bg-gold-400/30`), nu roșu.
- Buton secundar: `Nu` → `goto("idle")`.
- Rulează prin helperul existent `run(() => confirmOrder(orderId))`.
- Afișează `error` sub butoane, la fel ca celelalte branch-uri.

**Branch `idle`** — în ramura „comandă activă" (`!cancelled && !shipped`), adaugă
butonul **Confirmare** ca **primul** buton, vizibil doar cât `isNew`:

```
{isNew && (
  <button onClick={() => goto("confirm-order")}
    className="px-3 py-1 rounded-sm text-xs font-medium bg-gold-400/10 text-gold-300 hover:bg-gold-400/20 transition-colors">
    Confirmare
  </button>
)}
```

Ordinea în rând pentru o comandă nouă: **Confirmare · Expediat · Anulare · Șterge**.
După confirmare (status `in_procesare`), `revalidatePath` re-randează rândul:
`isNew` devine fals → Confirmare dispare; Expediat + Anulare rămân (o comandă
confirmată tot trebuie expediată); coloana de status arată „În procesare".

## Flux

```
Comandă nouă (status "noua")
  └─ admin apasă „Confirmare"
       └─ „Trimit confirmarea către client?" [Da, confirmă] [Nu]
            └─ Da → confirmOrder(orderId)
                 ├─ email trimis OK → status "in_procesare", rând reîncărcat,
                 │    Confirmare dispare, status „În procesare"
                 └─ email eșuat → status neschimbat, eroare inline afișată
```

## Tratarea erorilor

- **Neautorizat** (non-ADMIN): action aruncă `Error("Unauthorized")` — la fel ca
  celelalte acțiuni; nu e o cale accesibilă din UI-ul normal.
- **Comandă inexistentă:** eroare inline „Comanda nu a fost găsită."
- **Comandă deja confirmată/procesată:** eroare inline „Comanda a fost deja
  confirmată sau procesată." (protecție dublu-click).
- **Email eșuat:** eroare inline „Emailul nu a putut fi trimis. Încearcă din
  nou."; statusul rămâne `noua`, deci butonul e încă disponibil pentru re-încercare.

## Testare

Aceleași granițe ca acțiunile existente. Componenta client (`OrderActionsCell`)
nu e testată unitar (mediul Vitest e `node`, fără jsdom — la fel ca acum).

**`confirmOrder` (dacă acțiunile server ajung să aibă teste):**
- Non-ADMIN → aruncă.
- Comandă inexistentă → `{ ok: false }`, fără email, fără update.
- Status ≠ `noua` → `{ ok: false }`, fără email, fără update.
- Email aruncă → `{ ok: false }`, statusul rămâne `noua` (fără `order.update`).
- Cale fericită → email trimis, status `in_procesare`, `revalidatePath` apelat.

**Verificare manuală:**
- O comandă nouă arată butonul Confirmare; una expediată/anulată/în procesare nu.
- După confirmare, clientul primește mailul cu textul exact, iar rândul arată
  „În procesare" fără butonul Confirmare.

## În afara scopului (YAGNI)

- Fără email de confirmare automat la plasarea comenzii (rămâne acțiune manuală
  a adminului).
- Fără status nou (se refolosește `in_procesare`).
- Fără câmp de dată „confirmat la" separat (statusul e suficient).
- Fără posibilitatea de re-trimitere a mailului după confirmare (butonul dispare
  intenționat).
