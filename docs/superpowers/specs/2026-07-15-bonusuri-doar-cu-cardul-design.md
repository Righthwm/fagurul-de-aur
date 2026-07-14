# Borcane bonus doar cu plata cu cardul — design

**Data:** 2026-07-15
**Status:** aprobat de client, gata de plan de implementare

## Problema

Vrem să încurajăm plata cu cardul: toate borcanele gratuite din coș (atât
promoția pe kg „1 gratuit la 10kg", cât și bonusul de pachet) devin disponibile
**doar** dacă clientul plătește cu cardul. La ramburs, borcanele bonus nu sunt
incluse în comandă. În plus, un mesaj la checkout invită clientul să plătească cu
cardul ca să primească borcanele.

## Decizii luate cu clientul

| Întrebare | Decizie |
|---|---|
| Care bonusuri se condiționează | **Toate** — și promoția pe kg, și bonusul de pachet. |
| La ramburs, ce se întâmplă cu bonusurile din coș | **Rămân în coș, marcate „Doar cu plata card"** (greyed, mecanismul existent „indisponibil momentan"). Comutarea pe card le readuce instant; nu se pierd. |
| Unde se vede condiționarea | **Doar la checkout** (metoda de plată se alege acolo). În coș (drawer) apar normal, cu o notă „Gratuite la plata cu cardul". |

## Comportament așteptat (contractul funcțional)

| Stare | Rezultat |
|---|---|
| Card selectat, bonusuri în coș | Bonusurile sunt comandabile (după regulile de dreptul existente). |
| Ramburs selectat, bonusuri în coș | Toate liniile bonus sunt marcate „Doar cu plata card" și **nu** intră în comandă. |
| Comutare ramburs → card | Bonusurile redevin disponibile instant (rămân în coș la preț 0, doar eticheta se schimbă). |
| Comandă ramburs trimisă la server cu linii bonus (payload falsificat) | Serverul elimină toate liniile bonus. |
| Transport la ramburs | Borcanele bonus scoase nu mai contribuie la suprataxa de 2 lei/borcan. |

Subtotalul nu se schimbă între card și ramburs (bonusurile sunt oricum 0 lei);
se schimbă doar dacă primești borcanele și, marginal, transportul (mai puține
borcane expediate la ramburs).

## Arhitectură

Condiționarea are un singur principiu: **un bonus e „comandabil" doar dacă (a)
intră în dreptul din rezervorul lui ȘI (b) plata e cu cardul.** Partea (a) există
deja (`orderableBonusKeys`); adăugăm partea (b) ca parametru, ca să nu duplicăm
logica.

### 1. Logica pură (`lib/promo.ts`)

Ambele funcții primesc un parametru nou `cardPayment`, cu **implicit `true`** ca
apelanții și testele existente să rămână neschimbate acolo unde plata nu e
relevantă (ex. cart drawer, care nu știe metoda de plată).

```ts
export function orderableBonusKeys(items: CartItem[], cardPayment = true): Set<number> {
  if (!cardPayment) return new Set(); // ramburs: niciun bonus nu e comandabil
  // ...restul, neschimbat (dreptul pe rezervoare)...
}
```

```ts
export function enforceBonusEntitlement<T extends CheckoutLine>(
  lines: T[],
  catalogOf: (productId: string) => Product | undefined,
  cardPayment = true
): T[] {
  if (!cardPayment) return lines.filter((l) => !l.isBonus); // ramburs: scoate toate bonusurile
  // ...restul, neschimbat...
}
```

Gate-ul pe plată e aplicat **înaintea** logicii de drept: la ramburs nu contează
câte bonusuri sunt câștigate, niciunul nu e comandabil.

### 2. Checkout (`app/checkout/page.tsx`)

- `paymentMethod` e deja reactiv (`watch("paymentMethod")`).
- Calculul comandabil devine gate-at pe plată:
  ```ts
  const orderableKeys = orderableBonusKeys(items, paymentMethod === "card");
  const orderableItems = items.filter((i) => !i.isBonus || orderableKeys.has(i.bonusKey!));
  ```
- **Estimarea de transport** trimite acum `orderableItems` (post-gate), nu `items`
  brute — ca la ramburs borcanele bonus să nu mai adauge 2 lei/borcan. (Astăzi
  trimite toate liniile.)
- **Eticheta liniilor greyed** din sumar: când e ramburs, textul devine „Doar cu
  plata card" în loc de „Indisponibil momentan". (Când e card și un bonus e
  supra-revendicat, rămâne „Indisponibil momentan" ca acum.)
- **Nudge**: lângă selectorul de plată, dacă în coș există cel puțin un borcan
  bonus și metoda e ramburs, un mesaj evidențiat: „💳 Plătește cu cardul și
  primești cele N borcane gratuite. La ramburs nu sunt incluse." (N = numărul de
  linii bonus din coș.)

### 3. Garda de server (`lib/orders.ts`)

`persistOrder` pasează metoda de plată la gardă:
```ts
const orderedItems = enforceBonusEntitlement(input.items, catalogOf, input.paymentMethod === "card");
```
Fiindcă `orderedItems` alimentează subtotalul, transportul și liniile persistate,
o comandă ramburs nu va conține niciodată borcane bonus, indiferent de payload.
Shipping-ul de pe server e deja calculat pe `orderedItems`, deci se corectează
automat.

### 4. Cart drawer (`components/shop/CartDrawer.tsx`)

Coșul nu cunoaște metoda de plată (se alege la checkout), deci **nu** aplică
gate-ul — doar informează. Sub liniile bonus adăugăm o notă mică: „Gratuite la
plata cu cardul". `orderableBonusKeys(items)` rămâne apelat fără al doilea
argument (implicit `true`), deci comportamentul de drept din drawer e neschimbat.

## Testare

`lib/promo.test.ts`:
- `orderableBonusKeys(items, false)` → set gol, oricâte bonusuri câștigate.
- `orderableBonusKeys(items, true)` → identic cu comportamentul actual (regresie).
- `enforceBonusEntitlement(lines, catalogOf, false)` → toate liniile bonus scoase;
  liniile plătite rămân intacte.
- `enforceBonusEntitlement(lines, catalogOf, true)` → identic cu acum.

`lib/bonus-pack-flow.test.ts` (e2e):
- Un caz nou: coș cu pachet + borcan declanșator + 2 bonusuri revendicate, trecut
  prin gardă cu `cardPayment = false` → comanda conține doar liniile plătite, zero
  bonusuri.

## Ce NU intră în scop

- Nu adăugăm selector de plată în cart drawer (doar nota informativă).
- Nu schimbăm popup-urile de revendicare (clientul poate revendica bonusuri în coș
  înainte de a alege plata; gate-ul se aplică la checkout).
- Nu schimbăm regulile de drept existente (rezervoare, salcâm, propolis ×2).
