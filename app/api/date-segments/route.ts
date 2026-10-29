import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SNCF_URL = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records";
const PAGE_SIZE = 100;
const MAX_OFFSET = 9900;

// A resumable, bounded SNCF page reader. It does not build routes: callers
// must retain the returned segments and build the graph after loading them.
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const cursorText = request.nextUrl.searchParams.get("cursor") ?? "0";
  const cursor = Number(cursorText);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(cursor) || cursor < 0 || cursor > MAX_OFFSET || cursor % PAGE_SIZE !== 0) {
    return NextResponse.json({ error: "Date ou curseur invalide." }, { status: 400 });
  }
  const url = new URL(SNCF_URL);
  url.searchParams.set("where", "date = date'" + date + "' AND od_happy_card = 'OUI'");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(cursor));
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 900 }
    });
    if (!response.ok) {
      return NextResponse.json({ error: "La SNCF ne répond pas correctement.", retryable: response.status >= 500 || response.status === 429 }, { status: 502 });
    }
    const payload = await response.json();
    const records = Array.isArray(payload.results) ? payload.results : [];
    const total = typeof payload.total_count === "number" ? payload.total_count : null;
    const nextOffset = cursor + PAGE_SIZE;
    const hasMore = records.length === PAGE_SIZE && (total === null || nextOffset < total);
    const offsetLimitReached = hasMore && nextOffset > MAX_OFFSET;
    return NextResponse.json({
      date, records, total, fetched: records.length, cursor,
      nextCursor: hasMore && !offsetLimitReached ? String(nextOffset) : null,
      complete: !hasMore,
      limitedBySource: offsetLimitReached
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } });
  } catch {
    return NextResponse.json({ error: "Impossible de charger cette page SNCF. Réessaie avec le même curseur.", retryable: true }, { status: 502 });
  }
}
