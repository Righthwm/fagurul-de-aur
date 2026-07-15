# Flux „Expediat" cu email de tracking AWB — Design

**Data:** 2026-07-15
**Autor:** brainstorming cu Radu

## Scop

În panoul de admin, la Comenzi, adminul apasă un buton **„Expediat"** pe o comandă,
completează **orașul de expediere** și **AWB-ul Fan Courier**, iar sistemul:
1. salvează aceste date pe comandă și trece statusul pe `expediat`;
2. trimite automat un email clientului: comanda este în curs de livrare din sediul
   Fan Courier din orașul respectiv, cu AWB-ul respectiv.

Emailul pleacă de pe adresa businessului (`comenzi@faguruldeaur.ro`, domeniu verificat
în Resend) cu `reply-to: faguruldeaur@gmail.com`, iar adresa destinatarului se ia
automat din comandă (`order.customerEmail`).

## Context (ce există deja)

- `app/admin/comenzi/page.tsx` — tabel read-only cu comenzile (server component, doar ADMIN).
- `Order` (Prisma) conține deja `customerEmail`, `customerFirstName/LastName`, `orderNumber`,
  `status` (valori: `noua`, `in_procesare`, `expediat`, `livrat`, `anulata` — vezi
  `lib/utils.ts` `ORDER_STATUS_LABELS`).
- `lib/email.ts` — trimitere prin Resend. **Toate** emailurile actuale merg spre `MAIL_TO`
  (inboxul shopului), nu spre client. Există helper `esc()` pentru escapare HTML.
- `app/admin/clienti/actions.ts` `setUserRole` — tiparul de server action protejat ADMIN.
- Domeniul `faguruldeaur.ro` este **verificat în Resend** → putem trimite către clienți.

## Decizii luate

- **Nume buton = „Expediat"**, status rezultat = `expediat`.
- **From:** `Fagurul de Aur <comenzi@faguruldeaur.ro>` prin env `MAIL_FROM`; `reply-to`
  = `faguruldeaur@gmail.com`. (Nu se poate trimite literal „de pe gmail" — Gmail respinge
  prin SPF/DMARC. Domeniul propriu e soluția corectă și e deja verificat.)
- **Totul sau nimic:** trimitem emailul întâi; doar dacă reușește, persistăm statusul +
  AWB + oraș. Dacă emailul eșuează, nu se schimbă nimic în DB și adminul primește eroare.

## Arhitectură

### 1. Migrare bază de date (Prisma)

Pe modelul `Order`, două câmpuri opționale noi:

```prisma
awb          String?   // codul AWB Fan Courier
courierCity  String?   // orașul din care s-a expediat pachetul
```

Migrare: `prisma migrate dev --name order_shipping_awb`.

### 2. Email nou: `sendShippingEmail` (lib/email.ts)

Semnătură:

```ts
export interface ShippingEmailData {
  orderId: string;              // order.orderNumber
  customerEmail: string;        // destinatarul (din comandă)
  customerFirstName: string;
  courierCity: string;          // orașul de expediere
  awb: string;                  // codul AWB
}

export async function sendShippingEmail(data: ShippingEmailData): Promise<void>;
```

- Trimite `to: data.customerEmail` (nu spre `MAIL_TO`).
- `from: MAIL_FROM` (setat pe `comenzi@faguruldeaur.ro`), `replyTo: "faguruldeaur@gmail.com"`.
- Aruncă eroare la eșec (ca `send()` existent), ca action-ul să oprească persistarea.
- Toate valorile interpolate în HTML trec prin `esc()`.
- Text: „Salut {prenume}, comanda ta **{orderId}** este în curs de livrare din sediul
  **Fan Courier {courierCity}** cu AWB **{awb}**. O poți urmări pe fancourier.ro."

Refolosim helperul `send()` existent (are `from` fix `MAIL_FROM`), dar el forțează
`to: MAIL_TO`. Deci `sendShippingEmail` NU folosește `send()` — apelează direct
`getClient().emails.send({...})` cu `to` = clientul. Pentru asta, `getClient` trebuie
exportat sau `sendShippingEmail` scris în același modul (același modul — nicio schimbare
de vizibilitate necesară).

### 3. Server action (app/admin/comenzi/actions.ts)

```ts
"use server";
export async function markOrderShipped(
  orderId: string,     // Order.id
  courierCity: string,
  awb: string
): Promise<{ ok: true } | { ok: false; error: string }>;
```

Pași:
1. `auth()` → dacă `session.user.role !== "ADMIN"` → throw „Unauthorized".
2. Validare Zod: `courierCity` și `awb` trimmed, min 1 caracter (AWB min ex. 3).
3. Încarcă comanda; dacă lipsește → eroare.
4. **Trimite emailul** cu `sendShippingEmail(...)`. Dacă aruncă → prinde și întoarce
   `{ ok: false, error: "Emailul nu a putut fi trimis..." }` FĂRĂ a scrie în DB.
5. Doar după email reușit: `prisma.order.update` cu `awb`, `courierCity`, `status: "expediat"`.
6. `revalidatePath("/admin/comenzi")`.
7. Întoarce `{ ok: true }`.

### 4. UI — rând interactiv în tabel

Tabelul rămâne server component, dar coloana nouă „Livrare" randează o componentă
**client** `ShipOrderCell` (`app/admin/comenzi/ShipOrderCell.tsx`), primind ca props
`orderId`, `status`, `awb`, `courierCity`.

- Dacă `status === "expediat"` (sau are deja `awb`): afișează „AWB {awb} · {courierCity}"
  (read-only, fără buton).
- Altfel: buton **„Expediat"**. Click → afișează inline două `<input>` (Oraș expediere,
  AWB) + buton „Trimite" + „Anulează". Submit apelează `markOrderShipped` (server action),
  cu stare de loading; pe `{ ok: false }` afișează eroarea sub formular; pe `{ ok: true }`
  UI-ul se reîmprospătează prin revalidate.

## Fluxul de date

```
Admin click „Expediat" → completează oraș + AWB → Submit
  → markOrderShipped(orderId, city, awb)  [server action, ADMIN-only]
      → Zod validare
      → sendShippingEmail → Resend → email către order.customerEmail
      → (doar dacă email OK) prisma.order.update {awb, courierCity, status:"expediat"}
      → revalidatePath
  → tabelul afișează AWB + oraș, fără buton
```

## Tratarea erorilor

- Neautorizat (non-ADMIN): server action aruncă; UI oricum e sub layout ADMIN-only.
- Validare eșuată: `{ ok: false, error }` afișat sub formular, nimic salvat.
- Email eșuat: `{ ok: false, error }`, nimic salvat (totul sau nimic). Adminul retrimite.
- Comandă deja expediată: butonul nu apare (UI), iar dacă cumva se reapelează, e idempotent
  benign (retrimite email + rescrie aceleași valori) — acceptabil; nu adăugăm guard special.

## Testare

- `lib/email.test.ts` (dacă există tipar) sau test nou: `sendShippingEmail` construiește
  `to = customerEmail`, `replyTo = faguruldeaur@gmail.com`, iar textul conține orașul și
  AWB-ul escapate. Mock pe clientul Resend.
- Test pentru action: mock `auth` (ADMIN vs non-ADMIN), mock `prisma` și `sendShippingEmail`;
  verifică: non-ADMIN aruncă; email-eșuat NU scrie în DB; succes scrie status+awb+city.
- `tsc` clean, lint la baseline.

## Non-scop (YAGNI)

- Fără istoric de statusuri / timeline.
- Fără integrare API Fan Courier (AWB-ul se introduce manual).
- Fără editarea AWB-ului după expediere (dacă e nevoie, o adăugăm ulterior).
- Fără email de „livrat efectiv" (doar „în curs de livrare / expediat").
