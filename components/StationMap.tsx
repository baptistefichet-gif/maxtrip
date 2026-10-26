"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { LatLngExpression } from "leaflet";

export type MapStation = {
  name: string;
  lat: number;
  lon: number;
  count?: number;
};

function FitStations({ stations }: { stations: MapStation[] }) {
  const map = useMap();

  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ pan: false });
      if (!stations.length) {
        map.setView([46.6, 2.4], 5, { animate: false });
        return;
      }
      const points = stations.map(station => [station.lat, station.lon] as [number, number]);
      if (points.length === 1) {
        map.setView(points[0] as LatLngExpression, 6, { animate: false });
      } else {
        map.fitBounds(points, { padding: [34, 34], maxZoom: 6, animate: false });
      }
    };

    const frame = window.requestAnimationFrame(fit);
    const timer = window.setTimeout(fit, 200);
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.invalidateSize({ pan: false }))
      : null;
    if (observer) observer.observe(map.getContainer());

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [map, stations]);

  return null;
}

export default function StationMap({
  stations,
  originStation,
  selected,
  onSelect
}: {
  stations: MapStation[];
  originStation?: MapStation | null;
  selected?: string | null;
  onSelect?: (name: string) => void;
}) {
  const centre: LatLngExpression = [46.6, 2.4];
  const fitStations = useMemo(() => originStation
    ? [originStation, ...stations.filter(station => station.name !== originStation.name)]
    : stations, [originStation, stations]);
  const selectedStation = stations.find(station => station.name === selected);

  return (
    <div className="h-full min-h-[360px] w-full">
      <MapContainer className="h-full min-h-[360px] w-full" center={centre} zoom={5} scrollWheelZoom={false} preferCanvas>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitStations stations={fitStations} />
        {originStation && stations.filter(station => station.name !== originStation.name).map(station => (
          <Polyline
            key={"route-" + originStation.name + "-" + station.name}
            positions={[[originStation.lat, originStation.lon], [station.lat, station.lon]]}
            pathOptions={{ color: "#14865c", weight: selected === station.name ? 3 : 1.5, opacity: selected && selected !== station.name ? 0.2 : 0.55 }}
          />
        ))}
        {originStation && (
          <CircleMarker center={[originStation.lat, originStation.lon]} radius={9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#e8790c", fillOpacity: 1 }}>
            <Tooltip direction="top" permanent>{originStation.name} · départ</Tooltip>
          </CircleMarker>
        )}
        {stations.map(station => (
          <CircleMarker key={station.name} center={[station.lat, station.lon]}
            radius={selected === station.name ? 8 : 5}
            pathOptions={{ color: "#fff", weight: 2, fillColor: selected === station.name ? "#14865c" : "#24486f", fillOpacity: 0.96 }}
            eventHandlers={{ click: () => onSelect?.(station.name) }}>
            <Tooltip direction="top">{station.name}{station.count ? " · " + station.count + " train(s)" : ""}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
