"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import { useEffect } from "react";
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
    if (stations.length) {
      const points = stations.map(s => [s.lat, s.lon] as [number, number]);
      if (points.length === 1) map.setView(points[0] as LatLngExpression, 7);
      else map.fitBounds(points, { padding: [26, 26], maxZoom: 6 });
    }
  }, [map, stations]);
  return null;
}

export default function StationMap({
  stations, selected, onSelect
}: {
  stations: MapStation[];
  selected?: string | null;
  onSelect?: (name: string) => void;
}) {
  const centre: LatLngExpression = [46.6, 2.4];
  const selectedStation = stations.find(s => s.name === selected);
  return (
    <MapContainer center={centre} zoom={5} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitStations stations={stations} />
      {selectedStation && stations.filter(s => s.name !== selectedStation.name).map(station => (
        <Polyline
          key={station.name}
          positions={[[selectedStation.lat, selectedStation.lon], [station.lat, station.lon]]}
          pathOptions={{ color: "#14865c", weight: 2, opacity: 0.72 }}
        />
      ))}
      {stations.map(station => (
        <CircleMarker
          key={station.name}
          center={[station.lat, station.lon]}
          radius={selected === station.name ? 8 : 5}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: selected === station.name ? "#14865c" : "#24486f",
            fillOpacity: 0.96
          }}
          eventHandlers={{ click: () => onSelect?.(station.name) }}
        >
          <Tooltip direction="top">{station.name}{station.count ? ` · ${station.count} train(s)` : ""}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
