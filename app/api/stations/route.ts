import { NextResponse } from "next/server";

export const revalidate = 21600;

const RECORDS_URL = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records";
const FACETS_URL = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/facets";
const PAGE_SIZE = 100;
const MAX_GROUP_PAGES = 20;

type Row = Record<string, unknown>;
type FacetValue = { value?: string; name?: string };
type FacetGroup = { name?: string; facets?: FacetValue[] };

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

async function fetchGroupedValues(field: "origine" | "destination") {
  const values: string[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_GROUP_PAGES; page++) {
    const url = new URL(RECORDS_URL);
    url.searchParams.set("select", field);
    url.searchParams.set("group_by", field);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("lang", "fr");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 21600 }
    });
    if (!response.ok) {
      throw new Error("Group query for " + field + " returned HTTP " + response.status);
    }

    const data = await response.json();
    const rows = Array.isArray(data.results) ? data.results as Row[] : [];
    values.push(...rows.map(row => String(row[field] ?? "")));
    if (rows.length < PAGE_SIZE) break;
    offset += rows.length;
  }

  const unique = uniqueSorted(values);
  if (!unique.length) throw new Error("No grouped values returned for " + field);
  return unique;
}

async function fetchFacetFallback(field: "origine" | "destination") {
  const url = new URL(FACETS_URL);
  url.searchParams.append("facet", 'facet(name="' + field + '",limit=2000,sort="alphanum")');
  url.searchParams.set("lang", "fr");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 21600 }
  });
  if (!response.ok) throw new Error("Facet query for " + field + " returned HTTP " + response.status);

  const data = await response.json();
  const groups = Array.isArray(data.facets) ? data.facets as FacetGroup[] : [];
  const group = groups.find(item => item.name === field);
  const values = uniqueSorted((group?.facets ?? []).map(item => String(item.value ?? item.name ?? "")));
  if (!values.length) throw new Error("No facet values returned for " + field);
  return values;
}

async function getValues(field: "origine" | "destination") {
  try {
    return await fetchGroupedValues(field);
  } catch {
    return await fetchFacetFallback(field);
  }
}

export async function GET() {
  try {
    const [origins, destinations] = await Promise.all([
      getValues("origine"),
      getValues("destination")
    ]);

    return NextResponse.json({
      origins,
      destinations,
      countOrigins: origins.length,
      countDestinations: destinations.length,
      source: "SNCF Open Data",
      fetched_at: new Date().toISOString()
    }, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200" }
    });
  } catch (error) {
    console.error("stations_upstream_failure", error);
    return NextResponse.json({
      error: "Impossible de récupérer la liste complète des gares SNCF."
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
