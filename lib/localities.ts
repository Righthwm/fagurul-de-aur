import data from "@/lib/data/ro-localities.json";
import urbanData from "@/lib/data/urban-localities.json";

interface CountyData {
  name: string;
  localitati: string[];
}

const counties = (data as { judete: CountyData[] }).judete;
const byCounty = new Map(counties.map((c) => [c.name, c.localitati]));

// Urban localities (orașe / municipii and their component villages) per county,
// derived from the official SIRUTA "mediu" classification. Everything not listed
// is rural (sat / comună). Used to auto-detect urban/rural at checkout.
const urbanByCounty = new Map(
  Object.entries(urbanData as Record<string, string[]>).map(([county, list]) => [county, new Set(list)])
);

/** All localities for a county (empty array if the county is unknown). */
export function localitiesForCounty(county: string): string[] {
  return byCounty.get(county) ?? [];
}

/** Whether a locality belongs to the given county (used for server validation). */
export function isValidLocality(county: string, locality: string): boolean {
  return byCounty.get(county)?.includes(locality) ?? false;
}

/** Auto-detect urban vs rural from the selected locality (defaults to rural). */
export function localityTypeOf(county: string, locality: string): "urban" | "rural" {
  return urbanByCounty.get(county)?.has(locality) ? "urban" : "rural";
}
