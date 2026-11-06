/**
 * Géocodage via Nominatim (OpenStreetMap) — service public gratuit, usage
 * raisonnable (≤ 1 req/s, User-Agent requis).
 *
 * Retourne { postalCode, latitude, longitude, displayName } pour une ville
 * donnée. Null si introuvable ou si le service est indisponible.
 *
 * Utilisé :
 *  - à la création/édition d'un candidat (complète postalCode + coords)
 *  - au moment d'appliquer le filtre "localisation + rayon" sur /candidates
 *    (géocode le point de recherche à la volée)
 */
export type GeocodeResult = {
  postalCode: string | null;
  latitude: number;
  longitude: number;
  displayName: string;
};

export async function geocodeCity(query: string, countryHint = "be"): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");
    if (countryHint) url.searchParams.set("countrycodes", countryHint);
    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent": "DasoHub/1.0 (contact: tech@dasolabs.com)",
        "Accept-Language": "fr-BE,fr,en"
      },
      // Pas de cache Next — la MAJ se fait à la main.
      cache: "no-store"
    });
    if (!r.ok) return null;
    const data = await r.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;
    return {
      postalCode: first.address?.postcode ?? null,
      latitude: Number(first.lat),
      longitude: Number(first.lon),
      displayName: String(first.display_name ?? q)
    };
  } catch {
    return null;
  }
}

/** Haversine — distance en km entre deux points (lat/lng en degrés). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // rayon terrestre moyen en km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
