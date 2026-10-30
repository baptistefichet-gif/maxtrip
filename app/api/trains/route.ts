import { NextRequest, NextResponse } from "next/server";

export const revalidate = 1800;

const API_BASE = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records";
const MAX_LIMIT = 100;

function escapeOdsqlString(value: string) {
  return value.replace(/'/g, "''");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requestedLimit = Number(params.get("limit") || 50);
  const requestedOffset = Number(params.get("offset") || 0);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(MAX_LIMIT, requestedLimit)) : 50;
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.min(100000, requestedOffset)) : 0;
  const origin = params.get("origine")?.trim();
  const destination = params.get("destination")?.trim();
  const date = params.get("date")?.trim();

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "La date doit être au format AAAA-MM-JJ." }, { status: 400 });
  }
  if ((origin && origin.length > 100) || (destination && destination.length > 100)) {
    return NextResponse.json({ error: "Le nom de la gare est trop long." }, { status: 400 });
  }

  const where: string[] = [];
  if (origin) where.push("origine = '" + escapeOdsqlString(origin) + "'");
  if (destination) where.push("destination = '" + escapeOdsqlString(destination) + "'");
  if (date) where.push("date = date'" + date + "'");

  const url = new URL(API_BASE);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  // Do not pass a timezone for the date field: it is a calendar date, not a datetime.
  if (where.length) url.searchParams.set("where", where.join(" AND "));

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 }
    });
    if (!response.ok) {
      console.error("trains_upstream_failure", response.status);
      return NextResponse.json({
        error: "La source SNCF est temporairement indisponible."
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const data = await response.json();
    return NextResponse.json({
      results: Array.isArray(data.results) ? data.results : [],
      total_count: typeof data.total_count === "number" ? data.total_count : null,
      returned_count: Array.isArray(data.results) ? data.results.length : 0,
      query_info: { origin: origin ?? null, destination: destination ?? null, date: date ?? null },
      fetched_at: new Date().toISOString(),
      source: "SNCF Open Data",
      note: "Les disponibilités publiées ne constituent pas une réservation confirmée."
    }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Impossible de joindre les données SNCF pour le moment." }, { status: 502 });
  }
}
