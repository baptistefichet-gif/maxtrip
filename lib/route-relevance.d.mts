export interface JourneyForRelevance {
  key: string;
  origin: string;
  destination: string;
  departureMinutes: number;
  arrivalMinutes: number;
  changes: number;
  returns?: JourneyForRelevance[];
  [key: string]: unknown;
}
export interface RelevanceOptions {
  enabled?: boolean;
  showAllConnections?: boolean;
  returnRequired?: boolean;
  toleranceMinutes?: number;
}
export function applyConnectionRelevance<T extends JourneyForRelevance>(
  journeys: T[],
  options?: RelevanceOptions
): { visible: T[]; suppressed: T[] };

export function selectDiverseJourneys<T extends JourneyForRelevance & { durationMinutes: number }>(journeys: T[], limit: number, getDestination?: (journey: T) => string): T[];
