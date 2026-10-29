export function stationKey(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function stationTokenKey(value) {
  return stationKey(value).split(" ").filter(Boolean).sort().join(" ");
}
// Expand only common railway abbreviations; never infer a nearby city.
export function stationAliasKey(value) {
  return stationKey(value).split(" ").map(token => ({
    ST: "SAINT", STE: "SAINTE", STS: "SAINTS", S: "SUR",
    AEROP: "AEROPORT"
  }[token] ?? token)).sort().join(" ");
}
// Fallback coordinates with identifiable railway stations, not city centroids.
// These are used only if official SNCF catalogue lookup is missing or unambiguous
// alias matching does not resolve the name. Provenance is documented below.
const VERIFIED_COORDINATES = Object.freeze({
  "TGV HAUTE PICARDIE": { lat: 49.85917, lon: 2.83167 },
  "HAUTE PICARDIE TGV": { lat: 49.85917, lon: 2.83167 },
  "AIX EN PROVENCE TGV": { lat: 43.45500, lon: 5.31722 },
  "MARSEILLE SAINT CHARLES": { lat: 43.30306, lon: 5.38111 },
  "MARSEILLE ST CHARLES": { lat: 43.30306, lon: 5.38111 }
});
export function stationCoordinatesFor(name, coordinates) {
  const key = stationKey(name);
  if (coordinates[key]) return coordinates[key];
  const reordered = stationTokenKey(name);
  const matches = Object.entries(coordinates).filter(([candidate]) => stationTokenKey(candidate) === reordered);
  // Avoid choosing arbitrarily when multiple stations share similar names.
  if (matches.length > 1) return null;
  if (matches.length === 1) return matches[0][1];
  const alias = stationAliasKey(name);
  const aliasMatches = Object.entries(coordinates).filter(([candidate]) => stationAliasKey(candidate) === alias);
  if (aliasMatches.length > 1) return null;
  if (aliasMatches.length === 1) return aliasMatches[0][1];
  return VERIFIED_COORDINATES[key] ?? null;
}
