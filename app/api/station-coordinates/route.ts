import { NextResponse } from "next/server";
import { stationKey } from "@/lib/station-geocoding.mjs";
export const revalidate = 86400;
const API = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/records";
type Row = Record<string, unknown>;
export async function GET() {
  try {
    const first = await fetch(API + "?limit=100&offset=0", { next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000) });
    if (!first.ok) throw new Error("SNCF HTTP " + first.status);
    const firstData = await first.json();
    const total = Math.min(10000, Number(firstData.total_count) || 100);
    const pages: Row[] = Array.isArray(firstData.results) ? firstData.results : [];
    const offsets = Array.from({ length: Math.max(0, Math.ceil(total / 100) - 1) }, (_, i) => (i + 1) * 100);
    const failed: number[] = [];
    for (let i = 0; i < offsets.length; i += 8) {
      const wave = await Promise.allSettled(offsets.slice(i, i + 8).map(async offset => {
        const res = await fetch(API + "?limit=100&offset=" + offset, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error("SNCF HTTP " + res.status);
        const json = await res.json();
        return Array.isArray(json.results) ? json.results as Row[] : [];
      }));
      wave.forEach((item, index) => {
        if (item.status === "fulfilled") pages.push(...item.value);
        else failed.push(offsets[i + index]);
      });
    }
    const coordinates: Record<string, { lat: number; lon: number }> = {};
    for (const row of pages) {
      const name = String(row.nom ?? "");
      const raw = row.position_geographique;
      const point = Array.isArray(raw) ? { lat: Number(raw[0]), lon: Number(raw[1]) } : raw as { lat?: number; lon?: number } | undefined;
      if (!name || !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      const key = stationKey(name);
      if (!coordinates[key]) coordinates[key] = { lat: Number(point.lat), lon: Number(point.lon) };
    }
    return NextResponse.json({ coordinates, complete: failed.length === 0 && pages.length >= total, missingPages: failed.length, source: "SNCF Gares & Connexions" }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ coordinates: {}, complete: false, error: "Coordonnées indisponibles." }, { status: 502 });
  }
}
