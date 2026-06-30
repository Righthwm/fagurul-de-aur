/**
 * PROVIZORIU — tarife de transport estimative, folosite DOAR cât timp API-ul
 * Fan Courier nu este conectat (vezi lib/fancourier.ts). Când vor exista
 * credențialele reale, `estimateShipping` (lib/shipping.ts) folosește tariful
 * real al curierului, iar acest fișier devine doar un fallback.
 *
 * Model: ca la Fan Courier real, tariful intern este NAȚIONAL UNIFORM pe
 * greutate (același preț în toată țara, indiferent de distanță), plus o
 * suprataxă fixă pentru localitățile rurale (greu accesibile). Expedierea se
 * face din agenția Fan Courier Petroșani (jud. Hunedoara) — vezi `ORIGIN`.
 *
 * 👉 ACESTA este fișierul de editat după ce primești contractul Fan Courier:
 *    schimbă cifrele din `weightBrackets`, `overage` și `ruralSurchargeLei` cu
 *    prețurile tale reale negociate. Logica din lib/shipping.ts nu trebuie
 *    atinsă.
 *
 * Toate prețurile sunt în lei, incl. TVA. Greutatea coletului se calculează
 * automat din `weightKg` al fiecărui produs (lib/products.ts) × cantitate.
 */

export interface WeightBracket {
  /** Limita superioară a tranșei, în kg (inclusiv). */
  maxKg: number;
  /** Tarif național pentru această tranșă, în lei. */
  price: number;
}

export const SHIPPING_CONFIG = {
  /**
   * Punctul de expediere: agenția Fan Courier de unde pleacă coletele. Folosit
   * ca expeditor de către API-ul real (lib/fancourier.ts) când e conectat.
   */
  ORIGIN: { agency: "Petroșani", county: "Hunedoara", locality: "Petroșani" },

  /**
   * Date informative despre un borcan ambalat individual. Calculul real al
   * greutății folosește `weightKg` din lib/products.ts; valorile de aici sunt
   * doar de referință pentru estimarea coletului.
   */
  jar: { weightKg: 1.2, heightCm: 18, diameterCm: 10 },

  /**
   * Tarif național (lei) pe tranșă de greutate — același în toată țara.
   * Tranșele se evaluează de sus în jos: prima `maxKg >= greutate` câștigă.
   */
  weightBrackets: [
    { maxKg: 1, price: 18 },
    { maxKg: 2, price: 20 },
    { maxKg: 3, price: 22 },
    { maxKg: 5, price: 25 },
    { maxKg: 10, price: 32 },
    { maxKg: 15, price: 40 },
    { maxKg: 20, price: 48 },
  ] as WeightBracket[],

  /** Peste ultima tranșă: `basePrice` + `perKg` lei pentru fiecare kg peste `baseKg`. */
  overage: { baseKg: 20, basePrice: 48, perKg: 2 },

  /**
   * Suprataxă fixă (lei) pentru livrarea în localități rurale (sate / comune,
   * greu accesibile). Se adaugă o singură dată, indiferent de distanță.
   */
  ruralSurchargeLei: 8,
};

/** Tariful național pentru o greutate dată, în lei. */
export function baseRateForWeight(weightKg: number): number {
  for (const bracket of SHIPPING_CONFIG.weightBrackets) {
    if (weightKg <= bracket.maxKg) return bracket.price;
  }
  const { baseKg, basePrice, perKg } = SHIPPING_CONFIG.overage;
  const extraKg = Math.ceil(Math.max(0, weightKg - baseKg));
  return basePrice + extraKg * perKg;
}

/**
 * Tarif de transport PROVIZORIU (lei, incl. TVA): tarif național pe greutate +
 * suprataxă fixă pentru sate. Înlocuit de tariful real Fan Courier (expediat din
 * Petroșani) când e conectat.
 */
export function provisionalTariff(weightKg: number, localityType: "urban" | "rural"): number {
  const base = baseRateForWeight(weightKg);
  return localityType === "rural" ? base + SHIPPING_CONFIG.ruralSurchargeLei : base;
}
