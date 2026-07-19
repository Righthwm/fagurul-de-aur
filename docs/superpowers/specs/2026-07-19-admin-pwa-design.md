# Aplicație mobilă admin (PWA) — Design

**Data:** 2026-07-19
**Status:** Aprobat verbal, în așteptarea revizuirii specului scris

## Scop

Panoul admin al faguruldeaur.ro devine o aplicație instalabilă pe telefon
(PWA), în stil Shopify Admin: gestionezi comenzile de pe telefon și primești
**notificare push la fiecare comandă nouă**. Publicul țintă: administratorul
magazinului, pe **Android** (funcționează și pe desktop neschimbat; iOS 16.4+
suportă push doar după instalare pe ecranul de start — nu e țintă primară).

## Decizii (confirmate cu clientul)

| Întrebare | Decizie |
|---|---|
| Tip aplicație | PWA (aplicație web instalabilă), NU aplicație nativă în magazine |
| Funcții | Tot adminul existent: Comenzi (nucleu), Trafic, Mesaje, Clienți |
| Push | Da, la comandă nouă (ramburs creată / card plătită) |
| Platformă principală | Android |
| Sunet notificare | „Cha-ching" de casă de marcat, în limitele platformei (vezi §2.5) |

## Arhitectură pe scurt

Nu se construiește nimic separat: același Next.js, aceleași pagini admin,
aceeași autentificare NextAuth. Se adaugă trei straturi:

1. **PWA shell** — manifest + service worker → instalabilă, full-screen.
2. **Web Push** — chei VAPID + abonamente în Prisma + trimitere la comandă nouă.
3. **UI mobil** — paginile admin devin prietenoase pe ecran mic (carduri,
   tab bar jos); desktopul rămâne neschimbat.

---

## 1. PWA shell

### 1.1 Manifest (`app/manifest.ts`)

Next.js generează `/manifest.webmanifest` dintr-un fișier `app/manifest.ts`:

- `name`: „Fagurul de Aur — Admin", `short_name`: „FdA Admin"
- `start_url`: `/admin` (aplicația se deschide direct în panou)
- `display`: `standalone` (full-screen, fără UI de browser)
- `background_color` / `theme_color`: culorile temei existente (fundal închis,
  auriu)
- `icons`: PNG 192×192 și 512×512 (+ variantă `maskable`), generate din
  `public/logo.svg` cu `sharp` (deja folosit în proiect), salvate în `public/`.

### 1.2 Service worker (`public/sw.js`)

Rol minim, două responsabilități:

- **Push**: `push` event → `showNotification(...)`; `notificationclick` →
  deschide/focalizează `/admin/comenzi`.
- **Instalabilitate**: un handler `fetch` pass-through (necesar ca Chrome să
  considere aplicația instalabilă). Fără caching offline — panoul cere date
  live; singura excepție este o pagină statică `/offline` („Fără conexiune —
  reîncearcă") servită când navigarea eșuează.

Înregistrarea SW se face dintr-o componentă client montată în layoutul admin
(`navigator.serviceWorker.register("/sw.js")`), doar pentru utilizatori ADMIN.

### 1.3 Sesiune

Autentificarea rămâne NextAuth cu Credentials (email + parolă), neatinsă.
Singura schimbare: `session.maxAge` crește la **30 de zile** (în
`auth.config.ts`), ca adminul să nu se relogheze frecvent pe telefon.

---

## 2. Web Push la comandă nouă

### 2.1 Infrastructură

- Bibliotecă server: **`web-push`** (npm) cu chei **VAPID**.
- Chei generate o dată (`npx web-push generate-vapid-keys`) și stocate în env
  (Vercel): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  (`mailto:faguruldeaur@gmail.com`). Cheia publică e expusă și clientului
  (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`).

### 2.2 Model Prisma nou

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  endpoint  String   @unique
  p256dh    String
  auth      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

`User` primește relația inversă `pushSubscriptions PushSubscription[]`.
Migrare cu `prisma migrate` (PostgreSQL/Neon; buildul rulează deja
`prisma migrate deploy`).

### 2.3 Abonare (client → server)

- În panoul admin (pagina Comenzi sau layout) apare un buton
  **„Activează notificările"** vizibil când `Notification.permission !==
  "granted"` sau când nu există abonament activ.
- La apăsare: cere permisiunea → `pushManager.subscribe(...)` cu cheia publică
  VAPID → trimite abonamentul la un server action ADMIN-only
  (`savePushSubscription`) care face upsert pe `endpoint`.
- Un al doilea server action (`removePushSubscription`) șterge abonamentul
  („Dezactivează notificările").

### 2.4 Trimitere (server)

Funcție nouă `lib/push.ts` → `sendNewOrderPush({ orderId, total })`:

- Ia toate `PushSubscription` ale userilor cu `role: "ADMIN"`.
- Trimite fiecăruia payload JSON:
  `{ title: "🐝 Comandă nouă", body: "SB-XXXX — 145 lei", url: "/admin/comenzi" }`.
- **Best-effort, ca la Meta CAPI**: nu aruncă niciodată (o eroare de push nu
  are voie să strice checkoutul); la răspuns `404/410` (abonament expirat)
  șterge rândul din DB.
- No-op silențios dacă env-urile VAPID lipsesc.

**Puncte de declanșare** (exact unde se trimit azi emailurile de comandă):

1. **Ramburs**: în `/api/checkout` (app/api/checkout/route.ts), după
   `persistOrder` — comanda e definitivă la creare.
2. **Card**: în IPN-ul Netopia `/api/payment/confirm`, doar pe tranziția la
   `paid` (același loc unde se trimite emailul de comandă plătită). NU la
   plăți `pending`.

### 2.5 Sunetul „cha-ching" — ce se poate și ce nu

Cerința: sunet ca la Shopify. Realitatea platformei:

- **Aplicație în fundal / telefon blocat**: Chrome pe Android **nu permite
  sunet custom** la notificările web push — se aude sunetul de notificare al
  sistemului. Nicio implementare web nu poate ocoli asta (doar aplicațiile
  native pot). Notificarea vine cu vibrație + sunetul sistemului.
- **Aplicație deschisă (în prim-plan)**: redăm noi sunetul. Service workerul
  trimite un mesaj (`postMessage`) către fereastra deschisă, iar o componentă
  client din layoutul admin redă un „cha-ching" de casă de marcat **sintetizat
  cu Web Audio** (două lovituri scurte de clopoțel) — fără fișier audio și
  fără probleme de drepturi (sunetul original Shopify e protejat de drepturi
  de autor și nu îl folosim).

Specul acceptă explicit acest compromis: sunet custom doar în prim-plan,
sunet de sistem în fundal.

---

## 3. UI mobil

Toate schimbările sunt responsive (breakpoint `md`), **desktopul rămâne
vizual neschimbat**. Logica (server actions, state machine-ul acțiunilor)
nu se modifică.

### 3.1 Navigație

- Mobil (`< md`): sidebar-ul admin devine **bară de taburi fixă jos** cu 4
  intrări + iconițe (lucide-react, deja în proiect): Trafic, Comenzi, Mesaje,
  Clienți. Tabul activ evidențiat cu auriu.
- Desktop (`≥ md`): sidebar-ul actual, neschimbat.
- Implementare în `app/admin/layout.tsx` (aceleași linkuri, două prezentări).

### 3.2 Comenzi (nucleul)

- Mobil: fiecare comandă devine un **card**: rând 1 — număr comandă + status
  (badge colorat); rând 2 — client + telefon (link `tel:`); rând 3 — dată+oră,
  total, metoda de plată; rând 4 — acțiunile existente (Confirmare / Expediat
  / Anulare / Șterge) cu butoane late, ușor de atins (`min-height` 44px).
- `OrderActionsCell` rămâne sursa unică a acțiunilor (se refolosește în card).
- Desktop: tabelul actual, neschimbat.

### 3.3 Trafic, Mesaje, Clienți

- Trafic: cardurile de statistici trec pe 2 coloane pe mobil (deja parțial),
  graficul și jurnalul devin scrollabile orizontal unde e nevoie.
- Mesaje și Clienți: listele devin carduri/stivă pe mobil dacă tabelele nu
  încap; fără schimbări de logică.

---

## 4. În afara scopului (YAGNI)

- Aplicație nativă / Play Store / App Store.
- API JSON separat (server actions + cookie-uri acoperă tot).
- Mod offline cu cache de date sau sincronizare.
- Editarea produselor din telefon (catalogul e în cod).
- Push pentru mesaje de contact sau alte evenimente (doar comenzi noi).
- Setări de notificare per-utilizator (un singur admin; toți adminii primesc).

---

## 5. Tratarea erorilor

- **Push eșuat** → logat, comanda/checkout-ul neafectate (best-effort).
- **Abonament expirat** (410/404 de la serviciul de push) → șters din DB
  automat la prima trimitere eșuată.
- **Permisiune refuzată** în browser → butonul afișează „Notificările sunt
  blocate din setările telefonului" (nu putem recere permisiunea programatic).
- **Env VAPID lipsă** → abonarea e ascunsă, trimiterea e no-op (site-ul merge
  normal, ca înainte).
- **Ofline în aplicație** → pagina `/offline` cu buton de reîncercare.

---

## 6. Testare

**Unit (Vitest, tiparul existent cu mock-uri):**
- `lib/push.ts`: trimite către toate abonamentele ADMIN; nu aruncă la eroare;
  șterge abonamentul la 410; no-op fără env VAPID.
- Server actions de abonare: refuză non-ADMIN; upsert pe endpoint; ștergere.
- Punctele de declanșare: `/api/checkout` (ramburs) apelează push; IPN-ul
  apelează push doar pe tranziția `paid` (nu la `pending`/`failed`).

**Manual (Android):**
- Instalare de pe Chrome („Adaugă pe ecranul de start") → se deschide
  standalone pe `/admin`.
- „Activează notificările" → permisiune → comandă test → notificarea apare cu
  telefonul blocat; atingerea deschide Comenzi.
- Cu aplicația deschisă → comandă test → se aude „cha-ching".
- Fluxul complet pe mobil: comandă nouă → Confirmare → Expediat cu AWB.
