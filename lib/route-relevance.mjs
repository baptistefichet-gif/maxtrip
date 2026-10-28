const CITY_PREFIXES = [
  "AIX EN PROVENCE", "CLERMONT FERRAND", "SAINT ETIENNE", "LA ROCHELLE",
  "MONTPELLIER", "STRASBOURG", "PERPIGNAN", "BESANCON", "MULHOUSE",
  "MARSEILLE", "BORDEAUX", "TOULOUSE", "GRENOBLE", "CHAMBERY", "ANNECY",
  "AVIGNON", "VALENCE", "NARBONNE", "BAYONNE", "NIMES", "ORLEANS",
  "POITIERS", "LIMOGES", "ANGERS", "NANTES", "RENNES", "LILLE", "LYON",
  "DIJON", "TOURS", "REIMS", "METZ", "NANCY", "ROUEN", "CAEN", "BREST",
  "AMIENS", "TARBES", "PAU", "NICE", "TOULON", "PARIS"
];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("fr-FR");
}

function canonicalDestination(value) {
  const normalized = normalize(value);
  return CITY_PREFIXES.find(prefix => normalized === prefix || normalized.startsWith(prefix + " ")) ?? normalized;
}

function hasCompatibleReturn(journey) {
  return Array.isArray(journey?.returns) && journey.returns.length > 0;
}

/**
 * Hides an indirect journey only when a direct to the same destination:
 * - departs within toleranceMinutes, or departs later and arrives no later,
 * - arrives no later,
 * - and also has a compatible return if the user requires one.
 * Returns suppressed routes separately so the UI can expose them explicitly.
 */
export function applyConnectionRelevance(journeys, options = {}) {
  const {
    enabled = false,
    showAllConnections = false,
    returnRequired = false,
    toleranceMinutes = 60
  } = options;

  if (!enabled || showAllConnections) {
    return { visible: [...journeys], suppressed: [] };
  }

  const visible = [];
  const suppressed = [];
  for (const candidate of journeys) {
    if (returnRequired && !hasCompatibleReturn(candidate)) continue;
    if (Number(candidate?.changes ?? 0) === 0) {
      visible.push(candidate);
      continue;
    }

    const dominated = journeys.some(direct => {
      if (Number(direct?.changes ?? 0) !== 0) return false;
      if (normalize(direct.destination) !== normalize(candidate.destination)) return false;
      if (returnRequired && !hasCompatibleReturn(direct)) return false;

      const directDeparture = Number(direct.departureMinutes);
      const indirectDeparture = Number(candidate.departureMinutes);
      const directArrival = Number(direct.arrivalMinutes);
      const indirectArrival = Number(candidate.arrivalMinutes);
      if (![directDeparture, indirectDeparture, directArrival, indirectArrival].every(Number.isFinite)) return false;

      return directArrival <= indirectArrival &&
        (Math.abs(directDeparture - indirectDeparture) <= toleranceMinutes ||
          directDeparture >= indirectDeparture);
    });

    (dominated ? suppressed : visible).push(candidate);
  }

  return { visible, suppressed };
}
