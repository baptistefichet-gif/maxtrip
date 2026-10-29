export function stationKey(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function stationTokenKey(value) {
  return stationKey(value).split(" ").filter(Boolean).sort().join(" ");
}
export function stationCoordinatesFor(name, coordinates) {
  const key = stationKey(name);
  if (coordinates[key]) return coordinates[key];
  const reordered = stationTokenKey(name);
  const matches = Object.entries(coordinates).filter(([candidate]) => stationTokenKey(candidate) === reordered);
  // Avoid choosing arbitrarily when multiple stations share similar names.
  return matches.length === 1 ? matches[0][1] : null;
}
