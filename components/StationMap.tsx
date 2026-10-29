"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap, ZoomControl } from "react-leaflet";
import { Fragment, useEffect, useMemo } from "react";
import type { LatLngExpression } from "leaflet";

export type MapStation = { name: string; lat: number; lon: number; count?: number };
export type MapJourney = { key: string; points: Array<MapStation | null>; changes: number; destinationLabel?: string };

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
  stations, originStation, journeys, selectedJourneyKey, selected, visibleDestination, onSelect
}: {
  stations: MapStation[];
  originStation?: MapStation | null;
  journeys?: MapJourney[];
  selectedJourneyKey?: string | null;
  selected?: string | null;
  visibleDestination?: string | null;
  onSelect?: (name: string) => void;
}) {
  const centre: LatLngExpression = [46.6, 2.4];
  const fitStations = useMemo(() => {
    const all = [...(originStation ? [originStation] : []), ...stations];
    return Array.from(new Map(all.map(station => [station.name, station])).values());
  }, [originStation, stations]);
  const visibleJourney = journeys?.find(journey => journey.key === selectedJourneyKey);
  const drawnJourneys = visibleJourney ? [visibleJourney] : visibleDestination ? (journeys ?? []).filter(journey => journey.destinationLabel === visibleDestination) : [];
  return (
    <div className="h-full min-h-[360px] w-full">
      <MapContainer className="h-full min-h-[360px] w-full" center={centre} zoom={5} zoomControl={false} scrollWheelZoom={false} preferCanvas>
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          updateWhenIdle
          keepBuffer={3}
        />
        <FitStations stations={visibleJourney ? visibleJourney.points.filter((point): point is MapStation => point !== null) : fitStations}/>
        {drawnJourneys.map(journey => journey.points.slice(0, -1).map((point, index) => {
          const next = journey.points[index + 1];
          if (!point || !next) return null;
          return <Polyline key={journey.key + "-leg-" + index} positions={[[point.lat, point.lon], [next.lat, next.lon]]}
            pathOptions={{ color: journey.changes === 0 ? "#16825d" : "#d97706", weight: journey.key === selectedJourneyKey ? 5 : 2.5, opacity: journey.key === selectedJourneyKey ? 1 : 0.45 }}/>;
        }))}
        {originStation && <>
          <CircleMarker center={[originStation.lat, originStation.lon]} radius={22} interactive={false} pathOptions={{ stroke: false, fillColor: "#e8790c", fillOpacity: 0.08 }}/>
          <CircleMarker center={[originStation.lat, originStation.lon]} radius={13} interactive={false} pathOptions={{ color: "#fff", weight: 3, fillColor: "#e8790c", fillOpacity: 1 }}>
            <Tooltip direction="top" permanent>{originStation.name} · départ</Tooltip>
          </CircleMarker>
        </>}
        {visibleJourney && visibleJourney.points.slice(1, -1).map((station, index) => station ? (
          <Fragment key={visibleJourney.key + "-transfer-" + index}>
            <CircleMarker center={[station.lat, station.lon]} radius={20} interactive={false} pathOptions={{ stroke: false, fillColor: "#d97706", fillOpacity: 0.08 }}/>
            <CircleMarker center={[station.lat, station.lon]} radius={12} interactive={false}
              pathOptions={{ color: "#fff", weight: 3, fillColor: "#d97706", fillOpacity: 1 }}>
              <Tooltip direction="top" permanent>Correspondance {index + 1} · {station.name}</Tooltip>
            </CircleMarker>
          </Fragment>
        ) : null)}
        {stations.map(station => <Fragment key={station.name}>
          <CircleMarker center={[station.lat, station.lon]} radius={28}
            interactive={true}
            pathOptions={{ color: selected === station.name ? "#14865c" : "#24486f", weight: 1, opacity: 0, fillColor: selected === station.name ? "#14865c" : "#24486f", fillOpacity: 0.02 }}
            eventHandlers={{ click: () => onSelect?.(station.name) }}>
            <Tooltip direction="top" permanent={selected === station.name} sticky>{station.name}{station.count ? " · " + station.count + " itinéraire(s)" : ""}</Tooltip>
          </CircleMarker>
          <CircleMarker center={[station.lat, station.lon]} radius={selected === station.name ? 13 : 10} interactive={false}
            pathOptions={{ color: "#fff", weight: 3, fillColor: selected === station.name ? "#14865c" : "#24486f", fillOpacity: 1 }}/>
        </Fragment>)}
      </MapContainer>
    </div>
  );
}
