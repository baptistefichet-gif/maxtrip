import { NextRequest, NextResponse } from "next/server";

export const revalidate = 1800;

const API_BASE = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records";
const MAX_LIMIT = 100;
const ALLOWED_FILTERS = new Set(["origine", "destination", "date", "od_happy_card", "heure_depart", "heure_arrivee"]);

function escapeFilterValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(params.get("limit") || 50)));
  const offset = Math.max(0, Math.min(100000, Number(params.get("offset") || 0)));
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
  if (origin) where.push(`origine = '${escapeFilterValue(origin)}'`);
  if (destination) where.push(`destination = '${escapeFilterValue(destination)}'`);
  if (date) where.push(`date = date'${date}'`);

  const url = new URL(API_BASE);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (where.length) url.searchParams.set("where", where.join(" AND "));

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 }
    });
    if (!response.ok) {
      const upstreamMessage = (await response.text()).slice(0, 400);
      return NextResponse.json(
        {
          error: `La source SNCF a répondu avec HTTP ${response.status}.`,
          upstreamStatus: response.status,
          upstreamMessage
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      results: Array.isArray(data.results) ? data.results : [],
      total_count: typeof data.total_count === "number" ? data.total_count : null,
      fetched_at: new Date().toISOString(),
      source: "SNCF Open Data",
      note: "Les disponibilités publiées ne constituent pas une réservation confirmée."
    }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Impossible de joindre les données SNCF pour le moment." }, { status: 502 });
  }
}
