export type StationCoordinate = { lat: number; lon: number };
export function stationKey(value: string): string;
export function stationTokenKey(value: string): string;
export function stationCoordinatesFor(name: string, coordinates: Record<string, StationCoordinate>): StationCoordinate | null;
