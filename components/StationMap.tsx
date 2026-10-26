"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { LatLngExpression } from "leaflet";

export type MapStation = { name: string; lat: number; lon: number; count?: number };
export type MapJourney = { key: string; points: MapStation[] };

function FitStations({ stations }: { stations: MapStation[] }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ pan: false });
      if (!stations.length) { map.setView([46.6, 2.4], 5, { animate: false }); return; }
      const points = stations.map(station => [station.lat, station.lon] as [number, number]);
      if (points.length === 1) map.setView(points[0] as LatLngExpression, 6, { animate: false });
      else map.fitBounds(points, { padding: [34, 34], maxZoom: 6, animate: false });
    };
    const frame = window.requestAnimationFrame(fit);
    const timer = window.setTimeout(fit, 200);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize({ pan: false })) : null;
    if (observer) observer.observe(map.getContainer());
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); observer?.disconnect(); };
  }, [map, stations]);
  return null;
}

export default function StationMap({
  stations, originStation, journeys, selectedJourneyKey, selected, onSelect
}: {
  stations: MapStation[];
  originStation?: MapStation | null;
  journeys?: MapJourney[];
  selectedJourneyKey?: string | null;
  selected?: string | null;
  onSelect?: (name: string) => void;
}) {
  const centre: LatLngExpression = [46.6, 2.4];
  const fitStations = useMemo(() => {
    const all = [...(originStation ? [originStation] : []), ...stations];
    return Array.from(new Map(all.map(station => [station.name, station])).values());
  }, [originStation, stations]);
  const visibleJourney = journeys?.find(journey => journey.key === selectedJourneyKey);
  const drawnJourneys = visibleJourney ? [visibleJourney] : (journeys ?? []);
  return (
    <div className="h-full min-h-[360px] w-full">
      <MapContainer className="h-full min-h-[360px] w-full" center={centre} zoom={5} scrollWheelZoom={false} preferCanvas>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        <FitStations stations={visibleJourney ? visibleJourney.points : fitStations}/>
        {drawnJourneys.map(journey => journey.points.slice(0, -1).map((point, index) => {
          const next = journey.points[index + 1];
          return <Polyline key={journey.key + "-leg-" + index} positions={[[point.lat, point.lon], [next.lat, next.lon]]}
            pathOptions={{ color: journey.key === selectedJourneyKey ? "#14865c" : "#54708d", weight: journey.key === selectedJourneyKey ? 4 : 2, opacity: journey.key === selectedJourneyKey ? 0.9 : 0.28 }}/>;
        }))}
        {originStation && <CircleMarker center={[originStation.lat, originStation.lon]} radius={9} pathOptions={{ color: "#fff", weight: 2, fillColor: "#e8790c", fillOpacity: 1 }}><Tooltip direction="top" permanent>{originStation.name} · départ</Tooltip></CircleMarker>}
        {stations.map(station => <CircleMarker key={station.name} center={[station.lat, station.lon]} radius={selected === station.name ? 8 : 5}
          pathOptions={{ color: "#fff", weight: 2, fillColor: selected === station.name ? "#14865c" : "#24486f", fillOpacity: 0.96 }}
          eventHandlers={{ click: () => onSelect?.(station.name) }}>
          <Tooltip direction="top">{station.name}{station.count ? " · " + station.count + " itinéraire(s)" : ""}</Tooltip>
        </CircleMarker>)}
      </MapContainer>
    </div>
  );
}
