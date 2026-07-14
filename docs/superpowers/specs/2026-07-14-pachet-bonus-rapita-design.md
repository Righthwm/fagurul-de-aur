# Pachet 10 borcane rapiță +BONUS — design

**Data:** 2026-07-14
**Status:** aprobat de client, gata de plan de implementare

## Problema

Vrem o ofertă nouă: un pachet de 10 borcane de miere de rapiță la 300 lei care, pe
lângă promoția existentă „1 borcan gratuit la fiecare 10kg", oferă un **al doilea**
borcan bonus. Bonusul pachetului are reguli proprii, diferite de promoția normală:

- se deblochează abia când coșul conține **cel puțin un borcan de miere plătit care
  nu face parte dintr-un pachet** (fie era deja în coș, fie e adăugat după pachet);
- **salcâmul nu poate fi ales** ca bonus de pachet;
- **tinctura de propolis este o opțiune** și, dacă e aleasă, se adaugă **2 tincturi**
  gratuite (promoția normală acceptă doar miere).

## Decizii luate cu clientul

| Întrebare | Decizie |
|---|---|
| Cumul cu promoția „10kg → 1 gratuit" | **Da, se cumulează.** Pachetul intră în cei 10kg și declanșează promoția normală, plus bonusul propriu. |
| Preț pachet | **300 lei**, fără reducere (identic cu 10 borcane individuale). Valoarea ofertei = bonusul suplimentar. |
| Plasare buton | Pagina `/miere` și pagina produsului rapiță. |
| Declanșator bonus pachet | Orice **borcan de miere plătit** non-pachet (inclusiv rapiță sau salcâm). Propolisul nu declanșează. Borcanele gratuite nu declanșează. |
| Pachete multiple | **1 bonus per pachet.** Un singur borcan plătit non-pachet deblochează toate bonusurile de pachet. |
| Text buton | Pe patru rânduri: „Pachet 10 borcane rapiță" / „300 lei" / „1 borcan GRATIS acum" / „+1 GRATIS dacă mai adaugi unul". Butonul spune tot adevărul, ca nimeni să nu se simtă înșelat în coș. |
| Când intră pachetul în coș | **La click pe buton**, imediat. Popupul care urmează cere borcanul în plus, nu confirmarea pachetului. |
| Salcâm gratuit | Prima gratuitate (promoția normală de 10kg) **poate** fi salcâm — regula existentă rămâne neatinsă. A doua (bonusul de pachet) **nu poate**. |
| Închiderea popupului fără alegere | Pachetul rămâne în coș cu bonusul normal. Bonusul de pachet se acordă oricând mai târziu, când adaugă un borcan — chiar și din altă pagină. |

## Comportament așteptat (contractul funcțional)

Fluxul principal, exact 2 popupuri:

| Pas | Acțiune | Stare coș | Ecran |
|---|---|---|---|
| 1 | Click pe buton | Pachetul (300 lei, 10kg) intră în coș | — |
| 2 | — | 10kg plătit, 0 borcane non-pachet | **Popup 1** — catalogul: „Mai alege un borcan și mai primești unul gratis". Bonusul kg e deja câștigat, dar alegerea lui e **suspendată** cât timp popupul 1 e deschis. |
| 3 | Alege un borcan din catalog | 11kg plătit, 1 borcan non-pachet | Borcanul plătit (30 lei) intră în coș. Bonusul de pachet se deblochează. |
| 4 | — | 2 gratuități în așteptare | **Popup 2** — alegerea: întâi bonusul kg (**salcâm permis**), apoi bonusul de pachet (**fără salcâm**, cu propolis). Aceeași fereastră, secvențial. |
| | **Total** | **330 lei plătiți** | **2 produse gratuite** |

Alte cazuri:

- **Popup 1 închis fără alegere** → popupul 2 apare oricum, cu **o singură** gratuitate
  de ales (cea de la promoția de 10kg). Bonusul de pachet rămâne în așteptare până
  când adaugă un borcan de miere plătit, oricând, din orice pagină.
- 2 pachete + 1 borcan tei = 21kg → 2 bonusuri kg + 2 bonusuri pachet = **4 gratuite**.
- Pachet + propolis, fără borcan de miere → **doar** bonusul kg. Propolisul nu deblochează bonusul de pachet.
- Se alege propolisul ca bonus de pachet → **o singură linie, cantitate 2**, preț 0.
- Se scoate borcanul declanșator după revendicare → bonusul de pachet devine
  „indisponibil momentan" în coș și e eliminat la checkout (tiparul existent pentru
  bonusurile revendicate în exces).
- Bonusul de pachet se poate obține și fără popupul 1: dacă în coș există deja un
  borcan de miere plătit când se adaugă pachetul, se deblochează imediat.

## Arhitectură

### 1. Catalog (`lib/products.ts`, `types/index.ts`)

`ProductVariant` primește un câmp nou:

```ts
/** Marchează un pachet multi-borcan care acordă un bonus propriu, separat de
 *  promoția pe kilograme. */
bonusPack?: boolean;
```

Rapița primește varianta:

```ts
{ type: "Pachet 10 borcane (10kg)", price: 300, weightKg: 14, bonusPack: true }
```

`bonusPack` este sursa de adevăr pentru dreptul la bonus — nu parsăm eticheta ca să
decidem dreptul la gratuități. Eticheta rămâne totuși parsată de logica existentă,
care funcționează corect fără modificări:

- `honeyKgFromLabel("Pachet 10 borcane (10kg)")` → `10` (regexul sare peste
  „10 borcane" fiindcă nu e urmat de „kg" și prinde „(10kg)"), deci pachetul
  contribuie 10kg la promoția normală — exact ce vrem pentru cumul.
- `honeyJarCount` din `lib/shipping.ts` prinde „10 borcane" → 10 borcane, deci
  suprataxa de livrare e corectă (30 lei urban + 10×5 = 80 lei).
- `weightKg: 14` = 10 borcane × 1.4kg brut.

**Constrângere de ordine:** varianta pachet trebuie adăugată **după** cea de 1kg, ca
`variants[0]` să rămână borcanul de 1kg. Mai multe locuri cad pe `variants[0]` ca
rezervă când nu găsesc o variantă după preț — în particular `honeyJarCount` din
`lib/shipping.ts`, care caută varianta după preț și nu o găsește pentru liniile bonus
(preț 0). Dacă pachetul ar fi primul, un borcan bonus de rapiță ar fi taxat la livrare
drept 10 borcane.

### 2. Logica de promoție (`lib/promo.ts`)

Două rezervoare de bonus, numărate **separat**. Fără separare, un bonus de pachet ar
fi numărat drept bonus kg și clientul ar pierde o gratuitate.

`CartItem` și `CheckoutLine` primesc:

```ts
/** Din ce promoție provine linia bonus. Absent pe liniile plătite. */
bonusSource?: "kg" | "pack";
```

Funcții existente — rămân pe rezervorul kg, dar filtrate pe sursă:

- `earnedFreeJars` — neschimbată (`floor(paidHoneyKg / 10)`); pachetul contribuie.
- `claimedFreeJars` — numără doar liniile cu `bonusSource === "kg"`.
- `unclaimedFreeJars`, `overclaimedFreeJars` — neschimbate ca formulă.

Funcții noi, pentru rezervorul pachet:

```ts
/** Câte pachete plătite sunt în coș. */
export function packCount(items: CartItem[]): number;

/** Borcane de miere plătite care NU provin dintr-un pachet. Declanșatorul. */
export function paidNonPackHoneyJars(items: CartItem[]): number;

/** Bonusuri de pachet câștigate: câte un bonus per pachet, dar 0 cât timp nu
 *  există niciun borcan de miere plătit non-pachet în coș. */
export function earnedPackBonuses(items: CartItem[]): number;

export function claimedPackBonuses(items: CartItem[]): number;
export function unclaimedPackBonuses(items: CartItem[]): number;
export function overclaimedPackBonuses(items: CartItem[]): number;
```

**Numărare pe linii, nu pe cantitate.** `claimedPackBonuses` numără *linii*, fiindcă
bonusul propolis e o singură revendicare cu cantitate 2. Liniile bonus nu se
comasează niciodată (fiecare are `bonusKey` unic), deci numărarea pe linii e sigură.

Reguli de eligibilitate pentru bonusul de pachet, expuse ca funcție pură refolosită
de popup și de garda server:

```ts
/** Produsele care pot fi alese ca bonus de pachet: toate mierile în afară de
 *  salcâm, plus tinctura de propolis. */
export function isPackBonusEligible(product: Product): boolean;

/** Câte bucăți se acordă gratuit pentru produsul ales: 2 pentru propolis, 1 altfel. */
export function packBonusQuantity(product: Product): number;
```

### 3. Garda server-side (`lib/promo.ts`, `lib/orders.ts`)

`enforceBonusEntitlement` **trebuie** extinsă — altfel un payload modificat manual
strecoară gratuități (salcâm ca bonus de pachet, 10 tincturi, bonus fără pachet).

Semnătura se schimbă din `honeyCategoryOf: (id) => category` în
`catalogOf: (id) => Product | undefined`, ca garda să poată citi `bonusPack` din
catalog în loc să ghicească din etichetă. Există **un singur apelant**
(`lib/orders.ts:73`), deci schimbarea e ieftină.

Garda recalculează din liniile **plătite**:

1. `paidKg` → `allowedKg = floor(paidKg / 10)` (pachetele contribuie).
2. `packs` = suma cantităților liniilor plătite a căror variantă din catalog are
   `bonusPack`; `paidNonPackJars` = borcane de miere plătite non-pachet.
   `allowedPack = paidNonPackJars >= 1 ? packs : 0`.
3. Liniile bonus se păstrează pe sursa lor, fiecare rezervor plafonat independent;
   surplusul e eliminat.
4. Pentru bonusurile de pachet: linia e **respinsă** dacă produsul nu trece de
   `isPackBonusEligible` (adică salcâmul), iar cantitatea e **forțată** la
   `packBonusQuantity(product)` (2 pentru propolis, 1 pentru miere).
5. Toate liniile bonus păstrate sunt forțate la `unitPrice: 0`.

Varianta din catalog se identifică după eticheta `line.variant`, la fel ca în
`lib/shipping.ts`.

Schema zod din `lib/orders.ts` primește `bonusSource: z.enum(["kg", "pack"]).optional()`.
Regula existentă „doar liniile bonus pot avea preț 0" rămâne neschimbată.

### 4. Coș (`lib/cart.ts`)

- `addBonusItem(product, source)` — parametru nou `source: "kg" | "pack"`.
  Cantitatea vine din `packBonusQuantity(product)` pentru sursa „pack" (2 la
  propolis), 1 pentru „kg". Pentru propolis, varianta de bază e `20ml`, nu 1kg —
  selecția variantei devine „prima variantă a produsului" când nu există variantă de 1kg.
- Selectoarele noi: `earnedPackBonuses`, `claimedPackBonuses`, `unclaimedPackBonuses`,
  `overclaimedPackBonuses`.
- Stare nouă pentru popupul 1: `packOfferOpen: boolean`, cu `openPackOffer()` /
  `closePackOffer()`. Trăiește în store (nu local în componentă) fiindcă
  `FreeJarPopup` trebuie să o citească pentru a se suspenda.
- **Migrare `reconcileItems`:** coșurile deja salvate în localStorage au `isBonus`
  fără `bonusSource`. La rehidratare, liniile bonus fără sursă primesc
  `bonusSource: "kg"` — altfel bonusurile vechi ar fi numărate greșit.
  Liniile bonus rămân forțate la preț 0, ca acum.

### 5. Popupul 2 — alegerea gratuităților (`components/shop/FreeJarPopup.tsx`)

Extindem componenta existentă cu un **mod**, nu creăm una nouă — caruselul, dots-urile
și animațiile sunt identice. Componenta știe deja să rămână deschisă cât timp mai
există gratuități nerevendicate (`visible = bonusChooserOpen && unclaimed > 0`), deci
cele două alegeri se fac natural în aceeași fereastră, una după alta.

- Modul se derivă din stare: `unclaimedFreeJars > 0` → mod `"kg"`; altfel
  `unclaimedPackBonuses > 0` → mod `"pack"`. Kg are prioritate, deci alegerile vin în
  ordinea din contractul funcțional.
- Lista de produse per mod: `"kg"` → mierile (comportamentul actual, salcâm inclus);
  `"pack"` → `products.filter(isPackBonusEligible)` (fără salcâm, cu propolis).
- Contorul din titlu („N borcane de ales") însumează **ambele** rezervoare:
  `unclaimedFreeJars + unclaimedPackBonuses`.
- Indexul caruselului se resetează la schimbarea modului, ca să nu rămână pe un
  index invalid între liste de lungimi diferite.
- Text în modul `"pack"`: titlu „Bonus pachet rapiță", iar pentru propolis butonul
  indică explicit că se adaugă 2 tincturi.
- `claim()` apelează `addBonusItem(product, mode)`.

**Suspendarea cât timp popupul 1 e deschis.** Condiția de afișare devine:

```ts
visible = bonusChooserOpen && !packOfferOpen && pending > 0;
```

Efectul de auto-deschidere rămâne neschimbat (setează `bonusChooserOpen` când crește
numărul de gratuități în așteptare). Fiindcă randarea e blocată de `!packOfferOpen`,
popupul 2 pur și simplu nu apare peste popupul 1, iar când acesta se închide — fie
prin alegerea unui borcan, fie prin X — popupul 2 apare singur, cu numărul corect de
gratuități. O singură condiție rezolvă ambele ramuri, fără efecte în lanț.

### 6. Popupul 1 — oferta (`components/shop/BonusPackOffer.tsx` — nouă)

Componentă client, montată în pagina `/miere` și în pagina produsului rapiță.

**Butonul** (patru rânduri, ca în decizia clientului):

```
Pachet 10 borcane rapiță
300 lei
✦ 1 borcan GRATIS acum
✦ +1 GRATIS dacă mai adaugi unul
```

**La click:** `addItem(rapita, packVariant)` + `openPackOffer()`. Pachetul e în coș
din acest moment; popupul nu mai cere confirmare pentru el.

**Conținutul popupului:** mesajul „Mai alege un borcan din catalog și mai primești un
borcan gratis", urmat de catalogul mierilor la 1kg (toate sortimentele, inclusiv
salcâm și rapiță). Click pe un borcan → `addItem(product, variantă 1kg)` +
`closePackOffer()`. Butonul X → doar `closePackOffer()`.

Popupul refolosește shell-ul vizual din `FreeJarPopup` (overlay, animații, buton de
închidere), dar afișează o **grilă** de borcane, nu un carusel — clientul alege dintre
6 sortimente și trebuie să le vadă pe toate deodată, nu să navigheze prin ele.

### 7. Checkout (`app/checkout/page.tsx`)

Filtrarea bonusurilor indisponibile (liniile 90–96) folosește azi doar
`overclaimedFreeJars`. Devine per-rezervor: un bonus e „indisponibil momentan" dacă
depășește dreptul **rezervorului său**. Payload-ul trimite `bonusSource` pe fiecare
linie bonus.

## Testare

`lib/promo.test.ts` — funcțiile sunt pure, deci se testează direct:

- pachet singur → 1 bonus kg, 0 bonusuri pachet (fără declanșator);
- pachet + 1 borcan tei → 1 bonus kg + 1 bonus pachet;
- borcan de miere deja în coș, apoi se adaugă pachetul → bonusul de pachet se
  deblochează imediat, fără popupul 1;
- pachet + 1 borcan rapiță de 1kg → bonusul de pachet se deblochează (rapița
  non-pachet e declanșator valid);
- pachet + propolis (fără miere) → 0 bonusuri pachet;
- 2 pachete + 1 borcan → 2 bonusuri kg + 2 bonusuri pachet;
- revendicările pe cele două rezervoare nu se contaminează reciproc;
- garda: salcâm ca bonus de pachet → eliminat;
- garda: propolis bonus cu cantitate falsificată (10) → forțat la 2;
- garda: bonus de pachet fără pachet în coș → eliminat;
- garda: bonus de pachet fără borcan declanșator → eliminat;
- garda: liniile bonus păstrate au preț 0.

`lib/shipping.test.ts` — pachetul readuce un caz care există în catalog:

- 1 pachet urban → 30 + 10×5 = 80 lei; greutate brută 14kg.

## Ce NU intră în scop

- Nu modificăm promoția existentă „10kg → 1 gratuit" în afară de filtrarea pe sursă.
- Nu adăugăm pachete pentru alte sortimente.
- Nu schimbăm badge-ul „Ofertă" de pe salcâm.
