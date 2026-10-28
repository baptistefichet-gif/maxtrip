import { NextRequest, NextResponse } from "next/server";

export const revalidate = 900;
export const maxDuration = 60;

type TrainRecord = Record<string, unknown>;
type Journey = {
  key: string;
  origin: string;
  destination: string;
  legs: TrainRecord[];
  departure: string;
  arrival: string;
  departureMinutes: number;
  arrivalMinutes: number;
  durationMinutes: number;
  changes: number;
  returns: Journey[];
};

const API_BASE = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records";
const PAGE_SIZE = 100;
const MAX_RECORDS = 3000;
const MAX_ROUTES = 180;
const CITY_PREFIXES = [
  "AIX EN PROVENCE", "CLERMONT FERRAND", "SAINT ETIENNE", "LA ROCHELLE",
  "MONTPELLIER", "STRASBOURG", "PERPIGNAN", "BESANCON", "MULHOUSE",
  "MARSEILLE", "BORDEAUX", "TOULOUSE", "GRENOBLE", "CHAMBERY", "ANNECY",
  "AVIGNON", "VALENCE", "NARBONNE", "BAYONNE", "NIMES", "ORLEANS",
  "POITIERS", "LIMOGES", "ANGERS", "NANTES", "RENNES", "LILLE", "LYON",
  "DIJON", "TOURS", "REIMS", "METZ", "NANCY", "ROUEN", "CAEN", "BREST",
  "AMIENS", "TARBES", "PAU", "NICE", "TOULON", "PARIS"
];
const CITY_TRANSFER_BASE_MINUTES: Record<string, number> = {
  "LILLE EUROPE|LILLE FLANDRES": 10,
  "LYON PART DIEU|LYON PERRACHE": 20,
  "MONTPELLIER SAINT ROCH|MONTPELLIER SUD DE FRANCE": 30,
  "AIX EN PROVENCE CENTRE|AIX EN PROVENCE TGV": 25
};

function field(record: TrainRecord, names: string[]) {
  for (const name of names) {
    const value = record[name];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}
function originOf(record: TrainRecord) { return field(record, ["origine"]); }
function destinationOf(record: TrainRecord) { return field(record, ["destination"]); }
function departureOf(record: TrainRecord) { return field(record, ["heure_depart"]); }
function arrivalOf(record: TrainRecord) { return field(record, ["heure_arrivee"]); }
function available(record: TrainRecord) { return field(record, ["od_happy_card"]).toUpperCase() === "OUI"; }
function normal(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("fr-FR").replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
}
function cityOf(station: string) {
  const value = normal(station);
  return CITY_PREFIXES.find(prefix => value === prefix || value.startsWith(prefix + " ")) ?? value;
}
function minutes(value: string) {
  const match = value.match(/^(\d{1,2})[:hH](\d{2})$|^(\d{1,2})$/);
  if (!match) return -1;
  const hour = Number(match[1] ?? match[3]);
  const minute = Number(match[2] ?? 0);
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return -1;
  return hour * 60 + minute;
}
function timeText(value: number) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return String(Math.floor(normalized / 60)).padStart(2, "0") + ":" + String(normalized % 60).padStart(2, "0");
}
function trainKey(record: TrainRecord) {
  return [field(record, ["train_no", "entity"]), originOf(record), destinationOf(record), departureOf(record), arrivalOf(record)].join("|");
}
function transferMinimum(previousStation: string, nextStation: string) {
  const previousNormalized = normal(previousStation);
  const nextNormalized = normal(nextStation);
  if (previousNormalized === nextNormalized) return 0;
  const previousCity = cityOf(previousStation);
  const nextCity = cityOf(nextStation);
  if (previousCity !== nextCity) return null;
  // "intramuros" is an SNCF city-level placeholder, not a physical station.
  // In Paris, remain conservative: any different station in the city requires at least one hour.
  if (previousCity === "PARIS") return 60;
  if (previousNormalized.includes("(INTRAMUROS)") || nextNormalized.includes("(INTRAMUROS)")) return 0;
  const pair = [previousNormalized, nextNormalized].sort().join("|");
  const base = CITY_TRANSFER_BASE_MINUTES[pair];
  return base === undefined ? null : base * 2;
}
function escapeOdsql(value: string) { return value.replace(/'/g, "''"); }

async function requestSNCF(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 900 }
      });
      if (response.ok || (response.status < 500 && response.status !== 429)) return response;
      lastError = new Error("SNCF HTTP " + response.status);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Échec réseau vers l'API SNCF.");
}

async function fetchWhere(where: string) {
  const firstUrl = new URL(API_BASE);
  firstUrl.searchParams.set("where", where);
  firstUrl.searchParams.set("limit", String(PAGE_SIZE));
  firstUrl.searchParams.set("offset", "0");

  const firstResponse = await requestSNCF(firstUrl.toString());
  if (!firstResponse.ok) throw new Error("SNCF HTTP " + firstResponse.status + " pour une recherche de segments MAX.");
  const firstData = await firstResponse.json();
  const total = typeof firstData.total_count === "number" ? firstData.total_count : PAGE_SIZE;
  const pageCount = Math.min(Math.ceil(total / PAGE_SIZE), Math.ceil(MAX_RECORDS / PAGE_SIZE));
  const records: TrainRecord[] = Array.isArray(firstData.results) ? firstData.results : [];

  for (let batchStart = 1; batchStart < pageCount; batchStart += 8) {
    const pageNumbers = Array.from({ length: Math.min(8, pageCount - batchStart) }, (_, index) => batchStart + index);
    const pages = await Promise.all(pageNumbers.map(async page => {
      const url = new URL(API_BASE);
      url.searchParams.set("where", where);
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(page * PAGE_SIZE));
      const response = await requestSNCF(url.toString());
      if (!response.ok) throw new Error("SNCF HTTP " + response.status + " pendant le chargement des pages.");
      const data = await response.json();
      return Array.isArray(data.results) ? data.results as TrainRecord[] : [];
    }));
    for (const rows of pages) records.push(...rows);
  }
  return { records: records.slice(0, MAX_RECORDS), total, truncated: total > MAX_RECORDS };
}

async function getRelevantTrains(date: string, roots: string[], direction: "origine" | "destination", maxLegs: number, preferredStations: string[] = []) {
  const allRecords: TrainRecord[] = [];
  const queriedStations = new Set<string>();
  let frontier = Array.from(new Set(roots.filter(Boolean)));
  let sourceCount = 0;
  let truncated = false;

  // Load every page only for the selected starting point. For connection levels,
  // load a bounded first page from a small set of likely transfer stations so the
  // serverless function does not spend its whole runtime paging through the dataset.
  for (let depth = 0; depth < maxLegs && frontier.length && allRecords.length < MAX_RECORDS; depth++) {
    const stations = frontier.filter(station => {
      const key = normal(station);
      if (queriedStations.has(key)) return false;
      queriedStations.add(key);
      return true;
    });
    frontier = [];
    if (!stations.length) break;

    const priority = ["LYON (intramuros)", "DIJON VILLE", "LILLE EUROPE", "BORDEAUX ST JEAN",
      "MARSEILLE ST CHARLES", "NANTES", "RENNES", "STRASBOURG", "MONTPELLIER SAINT ROCH",
      "TOURS", "AVIGNON TGV", "VALENCE TGV", "LE MANS", "ANGERS SAINT LAUD"];
    const preferredIndex = (station: string) => preferredStations.findIndex(preferred =>
      normal(station) === normal(preferred) || transferMinimum(station, preferred) !== null
    );
    stations.sort((a, b) => {
      const preferredA = preferredIndex(a);
      const preferredB = preferredIndex(b);
      if (preferredA >= 0 || preferredB >= 0) {
        if (preferredA < 0) return 1;
        if (preferredB < 0) return -1;
        if (preferredA !== preferredB) return preferredA - preferredB;
      }
      const ai = priority.findIndex(value => normal(a).startsWith(normal(value)));
      const bi = priority.findIndex(value => normal(b).startsWith(normal(value)));
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b, "fr");
    });

    const stationLimit = depth === 0 ? 1 : (depth === 1 ? 16 : 8);
    const selectedStations = depth === 0 ? stations : stations.slice(0, stationLimit);
    if (stations.length > selectedStations.length) truncated = true;

    // Use smaller ODSQL OR-groups at connection levels to keep individual payloads bounded.
    const batchSize = depth === 0 ? 1 : 4;
    for (let index = 0; index < selectedStations.length; index += batchSize) {
      const batch = selectedStations.slice(index, index + batchSize);
      const stationClause = batch.map(station => direction + " = '" + escapeOdsql(station) + "'").join(" OR ");
      const where = "date = date'" + date + "' AND od_happy_card = 'OUI' AND (" + stationClause + ")";
      let rows: TrainRecord[] = [];
      let total = 0;
      if (depth === 0) {
        const rootResult = await fetchWhere(where);
        rows = rootResult.records;
        total = rootResult.total;
        truncated = truncated || rootResult.truncated;
      } else {
        const batchUrl = new URL(API_BASE);
        batchUrl.searchParams.set("where", where);
        batchUrl.searchParams.set("limit", String(PAGE_SIZE));
        batchUrl.searchParams.set("offset", "0");
        const response = await requestSNCF(batchUrl.toString());
        if (!response.ok) throw new Error("SNCF HTTP " + response.status + " pendant la recherche d'itinéraires.");
        const data = await response.json();
        rows = Array.isArray(data.results) ? data.results : [];
        total = typeof data.total_count === "number" ? data.total_count : rows.length;
        if (total > rows.length) truncated = true;
      }
      sourceCount += total;
      allRecords.push(...rows);

      for (const record of rows) {
        const nextStation = direction === "origine" ? destinationOf(record) : originOf(record);
        if (nextStation && !queriedStations.has(normal(nextStation))) frontier.push(nextStation);
      }
      if (allRecords.length >= MAX_RECORDS) {
        truncated = true;
        break;
      }
    }

    frontier = Array.from(new Map(frontier.map(station => [normal(station), station])).values());
  }

  const deduplicated = Array.from(new Map(allRecords.map(record => [trainKey(record), record])).values());
  return { records: deduplicated.slice(0, MAX_RECORDS), total: sourceCount, truncated: truncated || deduplicated.length > MAX_RECORDS };
}

function makeJourneys(records: TrainRecord[], origin: string, destination: string | null, options: {
  start: number; end: number; maxLegs: number; minWait: number; maxWait: number; indirectOnly: boolean;
}) {
  const adjacency = new Map<string, TrainRecord[]>();
  for (const record of records) {
    const from = originOf(record);
    const to = destinationOf(record);
    const dep = minutes(departureOf(record));
    const rawArr = minutes(arrivalOf(record));
    if (!from || !to || !available(record) || dep < 0 || rawArr < 0) continue;
    let arr = rawArr;
    if (arr < dep) arr += 1440;
    const fromCity = cityOf(from);
    if (!adjacency.has(fromCity)) adjacency.set(fromCity, []);
    adjacency.get(fromCity)!.push({ ...record, __depMin: dep, __arrMin: arr });
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => Number(a.__depMin) - Number(b.__depMin));
  }

  const found: Journey[] = [];
  const routeKeys = new Set<string>();
  // In Explore mode, keep every distinct route discovered up to the global safety cap.
  // The previous per-destination limit of four severely understated destination counts.
  const routeLimit = MAX_ROUTES;
  let visitedStates = 0;
  const maxStates = destination ? 15000 : 30000;

  function save(path: TrainRecord[]) {
    if (!path.length || (options.indirectOnly && path.length < 2)) return;
    const first = path[0];
    const last = path[path.length - 1];
    const finalDestination = destinationOf(last);
    if (destination && normal(finalDestination) !== normal(destination)) return;
    const key = path.map(trainKey).join(" >> ");
    if (routeKeys.has(key)) return;
    const existingForDestination = found.filter(route => normal(route.destination) === normal(finalDestination)).length;
    if (existingForDestination >= routeLimit || found.length >= MAX_ROUTES) return;
    routeKeys.add(key);

    const departureMinutes = Number(first.__depMin);
    let arrivalMinutes = Number(last.__arrMin);
    while (arrivalMinutes < departureMinutes) arrivalMinutes += 1440;
    found.push({
      key,
      origin: originOf(first),
      destination: finalDestination,
      legs: path.map(({ __depMin, __arrMin, ...record }) => record),
      departure: departureOf(first),
      arrival: arrivalOf(last),
      departureMinutes,
      arrivalMinutes,
      durationMinutes: arrivalMinutes - departureMinutes,
      changes: path.length - 1,
      returns: []
    });
  }

  function extend(path: TrainRecord[], visitedCities: Set<string>) {
    visitedStates++;
    if (visitedStates > maxStates || found.length >= MAX_ROUTES || path.length >= options.maxLegs) return;
    const previous = path[path.length - 1];
    const previousStation = destinationOf(previous);
    const candidates = adjacency.get(cityOf(previousStation)) ?? [];
    let scanned = 0;

    for (const next of candidates) {
      if (scanned++ >= 160) break;
      const nextOrigin = originOf(next);
      const nextDestination = destinationOf(next);
      const nextCity = cityOf(nextDestination);
      const minTransfer = transferMinimum(previousStation, nextOrigin);
      if (minTransfer === null || visitedCities.has(nextCity)) continue;

      let absoluteDep = Number(next.__depMin);
      const previousArrival = Number(previous.__arrMin);
      while (absoluteDep < previousArrival) absoluteDep += 1440;
      const wait = absoluteDep - previousArrival;
      if (wait < Math.max(options.minWait, minTransfer) || wait > options.maxWait) continue;

      const shift = absoluteDep - Number(next.__depMin);
      const adjusted = { ...next, __depMin: absoluteDep, __arrMin: Number(next.__arrMin) + shift };
      const nextPath = [...path, adjusted];
      if (!destination || normal(nextDestination) === normal(destination)) save(nextPath);
      if (destination && normal(nextDestination) === normal(destination)) continue;
      visitedCities.add(nextCity);
      extend(nextPath, visitedCities);
      visitedCities.delete(nextCity);
      if (visitedStates > maxStates || found.length >= MAX_ROUTES) break;
    }
  }

  const firstLegs: TrainRecord[] = [];
  for (const record of records) {
    if (!available(record) || normal(originOf(record)) !== normal(origin)) continue;
    const dep = minutes(departureOf(record));
    const arrRaw = minutes(arrivalOf(record));
    if (dep < 0 || arrRaw < 0 || dep < options.start || dep > options.end) continue;
    let arr = arrRaw;
    if (arr < dep) arr += 1440;
    firstLegs.push({ ...record, __depMin: dep, __arrMin: arr });
  }
  firstLegs.sort((a, b) => Number(a.__depMin) - Number(b.__depMin));

  for (const first of firstLegs) {
    const firstDestination = destinationOf(first);
    if (!destination || normal(firstDestination) === normal(destination)) save([first]);
    if (destination && normal(firstDestination) === normal(destination)) continue;
    if (options.maxLegs <= 1 || options.indirectOnly === false && !destination && found.length >= MAX_ROUTES) {
      if (options.maxLegs <= 1) continue;
    }
    const visitedCities = new Set<string>([cityOf(origin), cityOf(firstDestination)]);
    if (options.maxLegs > 1) extend([first], visitedCities);
    if (found.length >= MAX_ROUTES) break;
  }

  return found.sort((a, b) => a.departureMinutes - b.departureMinutes || a.durationMinutes - b.durationMinutes);
}

function combineTrainSets(...sets: Array<{ records: TrainRecord[]; total: number; truncated: boolean }>) {
  const records = Array.from(new Map(sets.flatMap(set => set.records).map(record => [trainKey(record), record])).values());
  return {
    records,
    total: sets.reduce((sum, set) => sum + set.total, 0),
    truncated: sets.some(set => set.truncated)
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date")?.trim() ?? "";
  const origin = params.get("origine")?.trim() ?? "";
  const destination = params.get("destination")?.trim() || null;
  const startText = params.get("start") || "08:00";
  const endText = params.get("end") || "24:00";
  const maxChanges = Math.max(0, Math.min(3, Number(params.get("maxChanges") || 1)));
  const minWait = Math.max(10, Math.min(180, Number(params.get("minWait") || 20)));
  const maxWait = Math.max(minWait, Math.min(360, Number(params.get("maxWait") || 90)));
  const indirectOnly = params.get("routeType") === "indirect";
  const returnDate = params.get("returnDate")?.trim() ?? "";
  const returnStartText = params.get("returnStart") || "08:00";
  const returnEndText = params.get("returnEnd") || "24:00";
  const returnRequired = params.get("returnRequired") === "true";
  const start = minutes(startText);
  const end = minutes(endText);
  const returnStart = minutes(returnStartText);
  const returnEnd = minutes(returnEndText);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !origin) {
    return NextResponse.json({ error: "Une date et une gare de départ sont obligatoires." }, { status: 400 });
  }
  if (start < 0 || start >= 1440 || end <= start || end > 1440 || returnStart < 0 || returnStart >= 1440 || returnEnd <= returnStart || returnEnd > 1440) {
    return NextResponse.json({ error: "La plage horaire doit être valide et se terminer après le début." }, { status: 400 });
  }
  if (returnRequired && (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || returnDate < date)) {
    return NextResponse.json({ error: "La date du retour doit être égale ou postérieure à la date de l'aller." }, { status: 400 });
  }

  try {
    const maxLegs = params.get("routeType") === "direct" ? 1 : maxChanges + 1;

    // In a classic search, look backwards from the target first. This gives the
    // forward search a list of real feeder stations instead of guessing transfer hubs.
    const targetArrivalData = destination && maxLegs > 1
      ? await getRelevantTrains(date, [destination], "destination", 1)
      : null;
    const targetFeederStations = targetArrivalData
      ? Array.from(new Set(targetArrivalData.records.map(originOf).filter(Boolean)))
      : [];
    const outboundRootData = await getRelevantTrains(date, [origin], "origine", maxLegs, targetFeederStations);
    const outboundData = targetArrivalData
      ? combineTrainSets(outboundRootData, targetArrivalData)
      : outboundRootData;

    let routes = makeJourneys(outboundData.records, origin, destination, {
      start, end, maxLegs,
      minWait, maxWait, indirectOnly
    });

    if (returnRequired) {
      const returnArrivalData = await getRelevantTrains(returnDate, [origin], "destination", maxLegs);
      let returnData = returnArrivalData;

      // For a classic trip, explore outward from the selected destination as well,
      // then join it with the legs that arrive at the return station.
      if (destination && maxLegs > 1) {
        const returnFeederStations = Array.from(new Set(returnArrivalData.records.map(originOf).filter(Boolean)));
        const returnDepartureData = await getRelevantTrains(returnDate, [destination], "origine", maxLegs, returnFeederStations);
        returnData = combineTrainSets(returnArrivalData, returnDepartureData);
      }

      const returnStartMinutes = returnStart;
      const returnEndMinutes = returnEnd;
      const returnCache = new Map<string, Journey[]>();
      routes = routes.map(route => {
        const destinationKey = normal(route.destination);
        let matchingReturns = returnCache.get(destinationKey);
        if (!matchingReturns) {
          matchingReturns = makeJourneys(returnData.records, route.destination, origin, {
            start: returnStartMinutes, end: returnEndMinutes, maxLegs,
            minWait, maxWait, indirectOnly: false
          });
          returnCache.set(destinationKey, matchingReturns);
        }
        return { ...route, returns: matchingReturns };
      }).filter(route => route.returns.length > 0);
    }

    const rootRows = outboundData.records.filter(record => normal(originOf(record)) === normal(origin));
    const directRouteCount = makeJourneys(rootRows, origin, destination, { start, end, maxLegs: 1, minWait, maxWait, indirectOnly: false }).length;
    const rootAvailableRows = rootRows.filter(record => available(record));
    const rootInTimeWindow = rootAvailableRows.filter(record => {
      const departure = minutes(departureOf(record));
      return departure >= start && departure <= end;
    });

    return NextResponse.json({
      debug: {
        directRouteCount,
        rootRowsLoaded: rootRows.length,
        rootAvailableRows: rootAvailableRows.length,
        rootInTimeWindow: rootInTimeWindow.length,
        sampleRoot: rootRows.slice(0, 3).map(record => ({
          origine: originOf(record),
          destination: destinationOf(record),
          heure_depart: departureOf(record),
          heure_arrivee: arrivalOf(record),
          od_happy_card: field(record, ["od_happy_card"])
        }))
      },
      routes,
      totalRoutes: routes.length,
      sourceCount: outboundData.total,
      recordsLoaded: outboundData.records.length,
      truncated: outboundData.truncated || routes.length >= MAX_ROUTES,
      returnRequired,
      fetched_at: new Date().toISOString(),
      source: "SNCF Open Data"
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Impossible de construire les itinéraires SNCF.",
      source: "SNCF Open Data"
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
