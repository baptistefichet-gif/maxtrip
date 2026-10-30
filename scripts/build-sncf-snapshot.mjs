import { mkdir, writeFile } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const DATASET = "tgvmax";
const BASE = `https://data.sncf.com/api/explore/v2.1/catalog/datasets/${DATASET}`;
const FIELDS = [
  "date", "train_no", "entity", "origine", "destination", "heure_depart", "heure_arrivee", "od_happy_card"
];
const EXPORT_URL = `${BASE}/exports/json?select=${encodeURIComponent(FIELDS.join(","))}&where=${encodeURIComponent("od_happy_card = 'OUI'")}`;
const METADATA_URL = BASE;
const OUTPUT_DIR = "diagnostics";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}
function validDate(value) {
  return /^\\d{4}-\\d{2}-\\d{2}$/.test(value);
}
function validTime(value) {
  return /^\\d{1,2}:\\d{2}$/.test(value);
}
function normalizeRecord(row) {
  return {
    date: text(row.date),
    train_no: text(row.train_no),
    entity: text(row.entity),
    origine: text(row.origine),
    destination: text(row.destination),
    heure_depart: text(row.heure_depart),
    heure_arrivee: text(row.heure_arrivee)
  };
}
function recordKey(row) {
  return [row.date, row.train_no, row.entity, row.origine, row.destination, row.heure_depart, row.heure_arrivee].join("|");
}
async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "MaxTrip-Snapshot/1.0" },
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return response.json();
}

await mkdir(OUTPUT_DIR, { recursive: true });

const [raw, metadata] = await Promise.all([
  fetchJson(EXPORT_URL, "SNCF export"),
  fetchJson(METADATA_URL, "SNCF metadata")
]);

const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : null;
if (!rows) throw new Error("SNCF export did not return a JSON array.");
if (rows.length < 1000) throw new Error(`Refusing suspicious snapshot: only ${rows.length} available rows.`);

const unique = new Map();
let invalidRows = 0;
for (const source of rows) {
  if (text(source.od_happy_card).toUpperCase() !== "OUI") continue;
  const row = normalizeRecord(source);
  if (!validDate(row.date) || !row.origine || !row.destination || !validTime(row.heure_depart) || !validTime(row.heure_arrivee)) {
    invalidRows++;
    continue;
  }
  unique.set(recordKey(row), row);
}
const records = [...unique.values()];
if (records.length < 1000) throw new Error(`Refusing snapshot after validation: only ${records.length} valid rows.`);
if (invalidRows > Math.max(100, rows.length * 0.01)) {
  throw new Error(`Refusing snapshot: ${invalidRows} invalid rows exceeds the 1% safety threshold.`);
}

const dates = new Map();
for (const row of records) {
  if (!dates.has(row.date)) dates.set(row.date, []);
  dates.get(row.date).push([
    row.train_no,
    row.entity,
    row.origine,
    row.destination,
    row.heure_depart,
    row.heure_arrivee
  ]);
}
const sortedDates = [...dates.keys()].sort();
if (sortedDates.length < 7 || sortedDates.length > 35) {
  throw new Error(`Refusing snapshot: unexpected date coverage (${sortedDates.length} distinct dates).`);
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "SNCF Open Data / tgvmax",
  sourceDatasetModifiedAt: metadata?.metas?.default?.modified ?? metadata?.metas?.modified ?? null,
  availability: "OUI only",
  fields: ["train_no", "entity", "origine", "destination", "heure_depart", "heure_arrivee"],
  dateRange: { from: sortedDates[0], to: sortedDates.at(-1) },
  recordCount: records.length,
  invalidRowsDiscarded: invalidRows,
  dates: Object.fromEntries(sortedDates.map(date => [date, dates.get(date)]))
};

const json = JSON.stringify(snapshot);
await pipeline(
  Readable.from([json]),
  createGzip({ level: 9 }),
  (await import("node:fs")).createWriteStream(`${OUTPUT_DIR}/maxtrip-current.json.gz`)
);

const metadataOut = {
  schemaVersion: snapshot.schemaVersion,
  generatedAt: snapshot.generatedAt,
  sourceDatasetModifiedAt: snapshot.sourceDatasetModifiedAt,
  dateRange: snapshot.dateRange,
  recordCount: snapshot.recordCount,
  invalidRowsDiscarded: invalidRows,
  uncompressedBytes: Buffer.byteLength(json),
  exportUrl: `${BASE}/exports/json (filtered to OUI; selected fields only)`
};
await writeFile(`${OUTPUT_DIR}/maxtrip-current.metadata.json`, JSON.stringify(metadataOut, null, 2) + "\n");

console.log(JSON.stringify(metadataOut, null, 2));
