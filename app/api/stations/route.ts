import { NextResponse } from "next/server";

export const revalidate = 21600;

const FACETS_URL = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/facets";

type FacetValue = { value?: string; name?: string };
type FacetGroup = { name?: string; facets?: FacetValue[] };

function readFacet(groups: FacetGroup[], field: string) {
  const group = groups.find(item => item.name === field);
  const values = (group?.facets ?? [])
    .map(item => String(item.value ?? item.name ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

export async function GET() {
  const url = new URL(FACETS_URL);
  url.searchParams.append("facet", 'facet(name="origine",limit=500,sort="alphanum")');
  url.searchParams.append("facet", 'facet(name="destination",limit=500,sort="alphanum")');
  url.searchParams.set("lang", "fr");

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 21600 }
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      return NextResponse.json({
        error: "Impossible de charger la liste officielle des gares SNCF.",
        upstreamStatus: response.status,
        details
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const data = await response.json();
    const groups = Array.isArray(data.facets) ? data.facets as FacetGroup[] : [];
    const origins = readFacet(groups, "origine");
    const destinations = readFacet(groups, "destination");
    if (!origins.length || !destinations.length) {
      return NextResponse.json({
        error: "L'API SNCF a répondu, mais les facettes origine/destination sont absentes.",
        availableFacetNames: groups.map(group => group.name).filter(Boolean)
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ origins, destinations, countOrigins: origins.length, countDestinations: destinations.length }, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200" }
    });
  } catch {
    return NextResponse.json({ error: "Connexion impossible à l'API des gares SNCF." }, { status: 502 });
  }
}
