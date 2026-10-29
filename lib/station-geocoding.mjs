export function stationKey(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function stationTokenKey(value) {
  return stationKey(value).split(" ").filter(Boolean).sort().join(" ");
}
// Official SNCF Gares & Connexions coordinates for names that do not match
// the TGV MAX catalogue consistently (source: garesetconnexions.sncf/fr/haute-picardie-tgv).
const VERIFIED_COORDINATES = { "TGV HAUTE PICARDIE": { lat: 49.859182, lon: 2.8319 }, "HAUTE PICARDIE TGV": { lat: 49.859182, lon: 2.8319 } };
export function stationCoordinatesFor(name, coordinates) {
  const key = stationKey(name);
  if (coordinates[key]) return coordinates[key];
  const reordered = stationTokenKey(name);
  const matches = Object.entries(coordinates).filter(([candidate]) => stationTokenKey(candidate) === reordered);
  // Avoid choosing arbitrarily when multiple stations share similar names.
  if (matches.length > 1) return null;
  if (matches.length === 1) return matches[0][1];
  return VERIFIED_COORDINATES[key] ?? null;
}
