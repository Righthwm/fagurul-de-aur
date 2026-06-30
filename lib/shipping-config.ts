/**
 * PROVIZORIU — tarife de transport estimative, folosite DOAR cât timp API-ul
 * Fan Courier nu este conectat (vezi lib/fancourier.ts). Când vor exista
 * credențialele reale, `estimateShipping` (lib/shipping.ts) folosește tariful
 * real al curierului, iar acest fișier devine doar un fallback.
 *
 * 👉 ACESTA este fișierul de editat după ce primești contractul Fan Courier:
 *    schimbă cifrele din `weightBrackets`, `overage` și `ruralSurcharge` cu
 *    prețurile tale reale negociate. Logica din lib/shipping.ts nu trebuie
 *    atinsă.
 *
 * Toate prețurile sunt în lei, incl. TVA. Greutatea coletului se calculează
 * automat din `weightKg` al fiecărui produs (lib/products.ts) × cantitate.
 */

export interface WeightBracket {
  /** Limita superioară a tranșei, în kg (inclusiv). */
  maxKg: number;
  /** Tarif de bază pentru zonă urbană, în lei. */
  price: number;
}

export interface DistanceBracket {
  /** Limita superioară a tranșei de distanță, în km (inclusiv). */
  maxKm: number;
  /** Suprataxă adăugată tarifului de bază, în lei. */
  surcharge: number;
}

export const SHIPPING_CONFIG = {
  /**
   * Date informative despre un borcan ambalat individual. Calculul real al
   * greutății folosește `weightKg` din lib/products.ts; valorile de aici sunt
   * doar de referință pentru estimarea coletului.
   */
  jar: { weightKg: 1.2, heightCm: 18, diameterCm: 10 },

  /**
   * Tarif de bază (lei) pe tranșă de greutate, zonă urbană, plată ramburs.
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
   * Suprataxă pentru localități rurale, după distanța estimată față de cea mai
   * apropiată agenție Fan Courier (reședința de județ). Evaluate de sus în jos.
   */
  ruralSurcharge: [
    { maxKm: 10, surcharge: 5 },
    { maxKm: 25, surcharge: 10 },
    { maxKm: 50, surcharge: 15 },
    { maxKm: Infinity, surcharge: 20 },
  ] as DistanceBracket[],

  /**
   * Distanță (km) folosită pentru un sat generic cât timp NU cunoaștem
   * coordonatele reale ale localității. Provizoriu, toate satele primesc această
   * estimare; API-ul Fan Courier o va înlocui cu distanța reală pe colet.
   * Modifică valoarea pentru a muta satele într-o altă tranșă de suprataxă.
   */
  defaultRuralDistanceKm: 30,
};

/** Tariful de bază (urban) pentru o greutate dată, în lei. */
export function baseRateForWeight(weightKg: number): number {
  for (const bracket of SHIPPING_CONFIG.weightBrackets) {
    if (weightKg <= bracket.maxKg) return bracket.price;
  }
  const { baseKg, basePrice, perKg } = SHIPPING_CONFIG.overage;
  const extraKg = Math.ceil(Math.max(0, weightKg - baseKg));
  return basePrice + extraKg * perKg;
}

/**
 * Distanța estimată (km) a unei localități față de cea mai apropiată agenție.
 * Provizoriu nu avem coordonate, deci satele primesc `defaultRuralDistanceKm`,
 * iar localitățile urbane sunt considerate la 0 km (agenție în oraș).
 */
export function estimateDistanceKm(localityType: "urban" | "rural"): number {
  return localityType === "rural" ? SHIPPING_CONFIG.defaultRuralDistanceKm : 0;
}

/** Suprataxa rurală (lei) pentru o distanță dată. */
export function ruralSurchargeForKm(km: number): number {
  for (const bracket of SHIPPING_CONFIG.ruralSurcharge) {
    if (km <= bracket.maxKm) return bracket.surcharge;
  }
  return SHIPPING_CONFIG.ruralSurcharge[SHIPPING_CONFIG.ruralSurcharge.length - 1].surcharge;
}

/**
 * Tarif de transport PROVIZORIU (lei, incl. TVA) pe baza greutății coletului și
 * a tipului de localitate. Înlocuit de tariful real Fan Courier când e conectat.
 */
export function provisionalTariff(weightKg: number, localityType: "urban" | "rural"): number {
  const base = baseRateForWeight(weightKg);
  const surcharge = localityType === "rural" ? ruralSurchargeForKm(estimateDistanceKm(localityType)) : 0;
  return base + surcharge;
}
