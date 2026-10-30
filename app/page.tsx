"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronUp, Clock3, Compass, ExternalLink, GitBranch, MapPinned, Search, TrainFront, SlidersHorizontal, Sparkles, CircleAlert, LoaderCircle, RefreshCw, X, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import type { MapStation } from "@/components/StationMap";
import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { applyConnectionRelevance, countHiddenAlternatives } from "@/lib/route-relevance.mjs";
import { stationCoordinatesFor, stationKey } from "@/lib/station-geocoding.mjs";

const StationMap = dynamic(() => import("@/components/StationMap"), {
  ssr: false,
  loading: () => <div className="flex min-h-[340px] items-center justify-center bg-slate-100 text-sm text-slate-500">Chargement de la carte…</div>
});

type TrainRecord = Record<string, unknown>;
type Journey = { key: string; origin: string; destination: string; legs: TrainRecord[]; departure: string; arrival: string; departureMinutes: number; arrivalMinutes: number; durationMinutes: number; changes: number; returns: Journey[] };
type MapJourney = { key: string; points: Array<MapStation | null>; changes: number };
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0") + ":00");
const END_HOURS = [...HOURS.slice(1), "24:00"];
const RESULT_PAGE_SIZE = 12;
function hourValue(value: string) { return value === "24:00" ? 1440 : Number(value.slice(0, 2)) * 60; }
function nextHour(value: string) { const next = Math.min(1440, hourValue(value) + 60); return next === 1440 ? "24:00" : String(Math.floor(next / 60)).padStart(2, "0") + ":00"; }
type StationCatalogue = { origins: string[]; destinations: string[] };
type SearchMode = "explore" | "classic";
type RouteType = "all" | "direct" | "indirect";

function HourSelect({ label, value, onChange, endOfDay = false, minExclusive }: { label: string; value: string; onChange: (value: string) => void; endOfDay?: boolean; minExclusive?: string }) {
  const options = (endOfDay ? END_HOURS : HOURS).filter(hour => minExclusive === undefined || hourValue(hour) > hourValue(minExclusive));
  return (
    <label className="block min-w-0 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <span className="relative mt-2 block">
        <select
          aria-label={label}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-10 font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        >
          {endOfDay && <option value="">Sans limite (jusqu’à la fin de la journée)</option>}
          {options.map(hour => <option key={hour} value={hour}>{hour === "24:00" ? "00 h · fin de journée" : hour.slice(0, 2) + " h"}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/>
      </span>
    </label>
  );
}

const INITIAL_STATIONS: MapStation[] = [
  { name: "Paris", lat: 48.8566, lon: 2.3522 },
  { name: "Lyon", lat: 45.764, lon: 4.8357 },
  { name: "Dijon", lat: 47.322, lon: 5.0415 },
  { name: "Lille", lat: 50.6292, lon: 3.0573 },
  { name: "Bordeaux", lat: 44.8378, lon: -0.5792 },
  { name: "Nantes", lat: 47.2184, lon: -1.5536 },
  { name: "Marseille", lat: 43.2965, lon: 5.3698 },
  { name: "Strasbourg", lat: 48.5734, lon: 7.7521 },
  { name: "Rennes", lat: 48.1173, lon: -1.6778 },
  { name: "Montpellier", lat: 43.6119, lon: 3.8772 },
  { name: "Tours", lat: 47.3941, lon: 0.6848 },
  { name: "Nîmes", lat: 43.8367, lon: 4.3601 },
  { name: "Toulouse", lat: 43.6045, lon: 1.444 },
  { name: "Nice", lat: 43.7102, lon: 7.262 },
  { name: "Avignon", lat: 43.9493, lon: 4.8055 },
  { name: "Valence", lat: 44.9334, lon: 4.8924 },
  { name: "Grenoble", lat: 45.1885, lon: 5.7245 },
  { name: "Annecy", lat: 45.8992, lon: 6.1294 },
  { name: "Chambéry", lat: 45.5646, lon: 5.9178 },
  { name: "Le Mans", lat: 48.0061, lon: 0.1996 },
  { name: "Angers", lat: 47.4784, lon: -0.5632 },
  { name: "Poitiers", lat: 46.5802, lon: 0.3404 },
  { name: "La Rochelle", lat: 46.1603, lon: -1.1511 },
  { name: "Limoges", lat: 45.8336, lon: 1.2611 },
  { name: "Clermont-Ferrand", lat: 45.7772, lon: 3.087 },
  { name: "Reims", lat: 49.2583, lon: 4.0317 },
  { name: "Metz", lat: 49.1193, lon: 6.1757 },
  { name: "Nancy", lat: 48.6921, lon: 6.1844 },
  { name: "Besançon", lat: 47.2378, lon: 6.0241 },
  { name: "Mulhouse", lat: 47.7508, lon: 7.3359 },
  { name: "Perpignan", lat: 42.6887, lon: 2.8948 },
  { name: "Toulon", lat: 43.1242, lon: 5.928 },
  { name: "Aix-en-Provence", lat: 43.5297, lon: 5.4474 },
  { name: "Saint-Étienne", lat: 45.4397, lon: 4.3872 },
  { name: "Rouen", lat: 49.4432, lon: 1.0993 },
  { name: "Caen", lat: 49.1829, lon: -0.3707 },
  { name: "Brest", lat: 48.3904, lon: -4.4861 },
  { name: "Amiens", lat: 49.8941, lon: 2.2958 },
  { name: "Orléans", lat: 47.9029, lon: 1.9093 },
  { name: "Bayonne", lat: 43.4929, lon: -1.4748 },
  { name: "Pau", lat: 43.2951, lon: -0.3708 },
  { name: "Tarbes", lat: 43.2328, lon: 0.0781 },
  { name: "Narbonne", lat: 43.1843, lon: 3.0031 }
];

function todayString() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getField(record: TrainRecord, candidates: string[]) {
  for (const key of candidates) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function getPlace(record: TrainRecord, direction: "origin" | "destination") {
  return direction === "origin"
    ? getField(record, ["origine", "origin", "gare_origine", "nom_gare_origine"])
    : getField(record, ["destination", "gare_destination", "nom_gare_destination"]);
}

function getTime(record: TrainRecord, direction: "departure" | "arrival") {
  return direction === "departure"
    ? getField(record, ["heure_depart", "departure_time", "heuredepart"])
    : getField(record, ["heure_arrivee", "arrival_time", "heurearrivee"]);
}

function formatTime(value: string) {
  if (!value) return "";
  const match = value.match(/(\d{1,2})[:hH]?(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value;
}

function isAvailable(record: TrainRecord) {
  const value = getField(record, ["od_happy_card", "disponibilite", "available", "tgvmax"]);
  return ["oui", "yes", "true", "1", "disponible"].includes(value.toLowerCase());
}


function normalizeText(value: string) {
  return value.trim().normalize("NFC").toLocaleUpperCase("fr-FR");
}

function matchesCityOrStation(value: string, query: string) {
  const station = normalizeText(value);
  const requested = normalizeText(query);
  return Boolean(station && requested && station.startsWith(requested));
}

function minutesOfDay(value: string) {
  const time = formatTime(value);
  const match = time.match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
}

function isWithinHours(value: string, start: string, end: string) {
  const time = formatTime(value);
  return Boolean(time && time >= start && time <= end);
}

function hasReverseReturn(outbound: TrainRecord, returns: TrainRecord[], start: string, end: string) {
  const from = getPlace(outbound, "origin");
  const to = getPlace(outbound, "destination");
  return returns.some(record =>
    isAvailable(record) &&
    normalizeText(getPlace(record, "origin")) === normalizeText(to) &&
    normalizeText(getPlace(record, "destination")) === normalizeText(from) &&
    isWithinHours(getTime(record, "departure"), start, end)
  );
}

function getTripKey(record: TrainRecord) {
  return [
    getField(record, ["train_no", "train_number", "entity"]),
    getPlace(record, "origin"),
    getPlace(record, "destination"),
    getTime(record, "departure"),
    getTime(record, "arrival")
  ].join("|");
}

function mapCityName(stationName: string) {
  const normalized = normalizeText(stationName);
  const aliases: Array<[string, string]> = [
    ["PARIS", "Paris"], ["LYON", "Lyon"], ["LILLE", "Lille"], ["BORDEAUX", "Bordeaux"],
    ["MARSEILLE", "Marseille"], ["NANTES", "Nantes"], ["STRASBOURG", "Strasbourg"],
    ["MONTPELLIER", "Montpellier"], ["RENNES", "Rennes"], ["TOULOUSE", "Toulouse"],
    ["NICE", "Nice"], ["AVIGNON", "Avignon"], ["VALENCE", "Valence"], ["GRENOBLE", "Grenoble"],
    ["ANNECY", "Annecy"], ["CHAMBERY", "Chambéry"], ["LE MANS", "Le Mans"], ["ANGERS", "Angers"],
    ["POITIERS", "Poitiers"], ["LA ROCHELLE", "La Rochelle"], ["LIMOGES", "Limoges"],
    ["CLERMONT", "Clermont-Ferrand"], ["REIMS", "Reims"], ["METZ", "Metz"], ["NANCY", "Nancy"],
    ["BESANCON", "Besançon"], ["MULHOUSE", "Mulhouse"], ["PERPIGNAN", "Perpignan"], ["TOULON", "Toulon"],
    ["AIX EN PROVENCE", "Aix-en-Provence"], ["SAINT ETIENNE", "Saint-Étienne"], ["ROUEN", "Rouen"],
    ["CAEN", "Caen"], ["BREST", "Brest"], ["AMIENS", "Amiens"], ["ORLEANS", "Orléans"],
    ["BAYONNE", "Bayonne"], ["PAU", "Pau"], ["TARBES", "Tarbes"], ["NARBONNE", "Narbonne"],
    ["NIMES", "Nîmes"], ["DIJON", "Dijon"], ["TOURS", "Tours"]
  ];
  const match = aliases.find(([prefix]) => normalized.startsWith(prefix));
  if (match) return match[1];
  return INITIAL_STATIONS.find(station => {
    const city = normalizeText(station.name);
    return normalized === city || normalized.startsWith(city + " ");
  })?.name ?? null;
}


// Vaul owns gesture arbitration, snapping and scroll handoff on touch devices.
// The desktop panel keeps its existing layout and interactions.
function MapItinerarySheet({ label, children }: { label: string; children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [stage, setStage] = useState(1);
  const [hasExpanded, setHasExpanded] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ height: 800, bottomInset: 0 });
  const pointer = useRef<{ id: number; startY: number; startHeight: number; stage: number } | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobile) return;
    const update = () => {
      const visual = window.visualViewport;
      const height = visual?.height ?? window.innerHeight;
      const bottomInset = visual ? Math.max(0, window.innerHeight - visual.offsetTop - visual.height) : 0;
      setViewport({ height, bottomInset });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [mobile]);

  if (!mobile) {
    return <aside aria-label={label} className="absolute bottom-5 left-5 top-5 z-[1100] flex w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_45px_rgba(15,23,42,0.22)] lg:w-[380px]">{children}</aside>;
  }

  const points = [56, Math.max(56, viewport.height * 0.5), Math.max(56, viewport.height * 0.75)];
  const height = dragHeight ?? points[stage];
  useEffect(() => { if (stage === 2) setHasExpanded(true); }, [stage]);
  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer.current = { id: event.pointerId, startY: event.clientY, startHeight: points[stage], stage };
    setDragHeight(points[stage]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    const delta = active.startY - event.clientY;
    setDragHeight(Math.max(points[Math.max(0, active.stage - 1)], Math.min(points[Math.min(2, active.stage + 1)], active.startHeight + delta)));
  };
  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    pointer.current = null;
    const delta = active.startY - event.clientY;
    if (!cancelled && Math.abs(delta) >= 35) setStage(Math.max(0, Math.min(2, active.stage + (delta > 0 ? 1 : -1))));
    setDragHeight(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <aside aria-label={label} className="fixed inset-x-0 z-[1100] flex flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-[0_12px_45px_rgba(15,23,42,0.22)]"
      style={{ bottom: viewport.bottomInset, height, transition: dragHeight !== null ? "none" : "height 260ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
      <div role="slider" tabIndex={0} aria-label="Hauteur du panneau des destinations" aria-valuemin={0} aria-valuemax={2} aria-valuenow={stage}
        aria-valuetext={["Replié", "Mi-hauteur", "Trois quarts de l’écran"][stage]}
        onKeyDown={event => {
          if (event.key === "ArrowUp") { event.preventDefault(); setStage(value => Math.min(2, value + 1)); }
          if (event.key === "ArrowDown") { event.preventDefault(); setStage(value => Math.max(0, value - 1)); }
          if (event.key === "Home") { event.preventDefault(); setStage(0); }
          if (event.key === "End") { event.preventDefault(); setStage(2); }
        }}
        onPointerDown={begin} onPointerMove={move} onPointerUp={event => finish(event)}
        onPointerCancel={event => finish(event, true)}
        className="flex h-12 shrink-0 touch-none select-none items-start justify-center px-4 pt-3 focus-visible:outline-2 focus-visible:outline-emerald-700"
        style={{ cursor: dragHeight !== null ? "grabbing" : "grab" }}>
        <span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-slate-400" />
        {stage === 1 && !hasExpanded && <span aria-hidden="true" className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-500">Glisser vers le haut ↑</span>}
      </div>
      <button type="button" aria-label={stage === 0 ? "Ouvrir le panneau à mi-hauteur" : "Replier complètement le panneau"} onClick={() => setStage(stage === 0 ? 1 : 0)}
        className="absolute right-2 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-700">
        {stage === 0 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {children}
    </aside>
  );
}

export default function HomePage() {
  const [mode, setMode] = useState<SearchMode>("explore");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [originOpen, setOriginOpen] = useState(false);
  const [originActiveIndex, setOriginActiveIndex] = useState(0);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [destinationActiveIndex, setDestinationActiveIndex] = useState(0);
  const [stations, setStations] = useState<StationCatalogue>({ origins: [], destinations: [] });
  const [stationCoordinates, setStationCoordinates] = useState<Record<string, { lat: number; lon: number }>>({});

  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState("");
  const [outDate, setOutDate] = useState(todayString());
  const [returnEnabled, setReturnEnabled] = useState(false);
  const [returnDate, setReturnDate] = useState(todayString());
  const [outStart, setOutStart] = useState("08:00");
  const [outEnd, setOutEnd] = useState("");
  const [returnStart, setReturnStart] = useState("08:00");
  const [returnEnd, setReturnEnd] = useState("");
  const [allowConnections, setAllowConnections] = useState(false);
  const [showAllConnections, setShowAllConnections] = useState(false);
  const [maxChanges, setMaxChanges] = useState("1");
  const [minWait, setMinWait] = useState("20");
  const [maxWait, setMaxWait] = useState("90");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<TrainRecord[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [sourceTotal, setSourceTotal] = useState<number | null>(null);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [truncationReasons, setTruncationReasons] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastFetch, setLastFetch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedExploreDestination, setSelectedExploreDestination] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const returnToMapRef = useRef(false);
  const [mapSelectedDestination, setMapSelectedDestination] = useState<string | null>(null);
  const [mapSelectedTripKey, setMapSelectedTripKey] = useState<string | null>(null);
  const [returnRecords, setReturnRecords] = useState<TrainRecord[]>([]);
  const [expandedTripKey, setExpandedTripKey] = useState<string | null>(null);
  const [expandedReturnKey, setExpandedReturnKey] = useState<string | null>(null);
  const [selectedJourneyKey, setSelectedJourneyKey] = useState<string | null>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);

  const originOptions = useMemo(() => {
    const query = normalizeText(originSearch);
    return stations.origins.filter(station => !query || normalizeText(station).includes(query)).slice(0, 12);
  }, [stations.origins, originSearch]);

  const destinationOptions = useMemo(() => {
    const query = normalizeText(destinationSearch);
    return stations.destinations.filter(station => !query || normalizeText(station).includes(query) || normalizeText(station).includes(query)).slice(0, 12);
  }, [stations.destinations, destinationSearch]);

  useEffect(() => {
    let active = true;
    async function loadStations() {
      try {
        const response = await fetch("/api/stations");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible de charger les gares SNCF.");
        const origins = Array.isArray(data.origins) ? data.origins as string[] : [];
        const destinations = Array.isArray(data.destinations) ? data.destinations as string[] : [];
        if (!active) return;
        setStations({ origins, destinations });
        const initialOrigin = origins.includes(origin) ? origin : (origins.find(value => normalizeText(value).startsWith("PARIS")) ?? origins[0] ?? "");
        const initialDestination = destinations.includes(destination) ? destination : (destinations.find(value => normalizeText(value).startsWith("LYON")) ?? destinations[0] ?? "");
        setOrigin(initialOrigin);
        setOriginSearch("");
        setDestination(initialDestination);
        setDestinationSearch("");
      } catch (err) {
        if (active) setStationsError(err instanceof Error ? err.message : "Impossible de charger les gares.");
      } finally {
        if (active) setStationsLoading(false);
      }
    }
    loadStations();
    return () => { active = false; };
  }, []);

  // Give Safari's native Back gesture a real in-page history entry for the destination dialog.
  // The journey data stays in React state: closing the dialog never reruns the SNCF search.
  const openDestinationDetails = (name: string) => {
    const state = window.history.state ?? {};
    const nextState = { ...state, __maxtripDestination: name };
    if (state.__maxtripDestination) window.history.replaceState(nextState, "", window.location.href);
    else window.history.pushState(nextState, "", window.location.href);
    setSelectedExploreDestination(name);
    setSelected(name);
    setSelectedJourneyKey(null);
    setExpandedTripKey(null);
    setExpandedReturnKey(null);
    setCurrentPage(1);
  };
  const closeDestinationDetails = () => {
    const returnToMap = returnToMapRef.current;
    returnToMapRef.current = false;
    if (returnToMap) { setMapExpanded(true); }
    if (window.history.state?.__maxtripDestination) {
      window.history.back();
    } else {
      setSelectedExploreDestination(null);
      setSelectedJourneyKey(null);
      setExpandedTripKey(null);
      setExpandedReturnKey(null);
    }
  };

  useEffect(() => {
    const onHistoryChange = (event: PopStateEvent) => {
      const name = event.state?.__maxtripDestination;
      setSelectedExploreDestination(typeof name === "string" ? name : null);
      setSelectedJourneyKey(null);
      setExpandedTripKey(null);
      setExpandedReturnKey(null);
    };
    window.addEventListener("popstate", onHistoryChange);
    return () => window.removeEventListener("popstate", onHistoryChange);
  }, []);

  useEffect(() => {
    if (mode !== "explore" || !selectedExploreDestination) return;
    const previousOverflow = document.body.style.overflow;
    modalReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusFirstControl = () => {
      const dialog = document.getElementById("search-results");
      const first = dialog?.querySelector<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])");
      first?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirstControl);
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDestinationDetails();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("search-results");
      const controls = Array.from(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", closeOnKeyDown);
      modalReturnFocusRef.current?.focus();
    };
  }, [mode, selectedExploreDestination]);

  const relevanceResult = useMemo(() => applyConnectionRelevance(journeys, {
    enabled: allowConnections,
    showAllConnections,
    returnRequired: returnEnabled,
    toleranceMinutes: 15
  }), [journeys, showAllConnections, allowConnections, returnEnabled]);
  const relevantJourneys = relevanceResult.visible;
  const suppressedConnectionCount = useMemo(() => {
    const hidden = applyConnectionRelevance(journeys, {
      enabled: allowConnections, showAllConnections: false, returnRequired: returnEnabled
    }).suppressed;
    return countHiddenAlternatives(hidden, mode === "explore" ? selectedExploreDestination : null,
      station => mapCityName(station) ?? station);
  }, [journeys, allowConnections, returnEnabled, mode, selectedExploreDestination]);

  const filtered = useMemo(() => {
    if (mode !== "explore" || !selectedExploreDestination) return relevantJourneys;
    return relevantJourneys.filter(journey => {
      const label = mapCityName(journey.destination) ?? journey.destination;
      return normalizeText(label) === normalizeText(selectedExploreDestination);
    });
  }, [relevantJourneys, mode, selectedExploreDestination]);

  const destinationSummaries = useMemo(() => {
    const summaries = new Map<string, { label: string; count: number; keys: Set<string> }>();
    for (const journey of relevantJourneys) {
      const label = mapCityName(journey.destination) ?? journey.destination;
      const key = normalizeText(label);
      if (!key) continue;
      let entry = summaries.get(key);
      if (!entry) {
        entry = { label, count: 0, keys: new Set<string>() };
        summaries.set(key, entry);
      }
      if (!entry.keys.has(journey.key)) {
        entry.keys.add(journey.key);
        entry.count++;
      }
    }
    return Array.from(summaries.values())
      .map(({ label, count }) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
  }, [relevantJourneys]);

  useEffect(() => {
    let active = true;
    fetch("/api/station-coordinates").then(response => response.ok ? response.json() : null)
      .then(data => { if (active && data?.coordinates) setStationCoordinates(data.coordinates); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const stationMapPoint = (name: string): MapStation | null => {
    const key = stationKey(name);
    const exact = stationCoordinatesFor(name, stationCoordinates);
    if (exact) return { name, lat: exact.lat, lon: exact.lon };
    // Only city-wide groupings use a city centroid, never an unrelated station.
    if (!key.includes("INTRAMUROS")) return null;
    const city = mapCityName(name);
    return INITIAL_STATIONS.find(station => station.name === city) ?? null;
  };

  const originMapStation = useMemo(() => {
    return stationMapPoint(origin);
  }, [origin, stationCoordinates]);

  const destinations = useMemo(() => {
    const names = new Map<string, number>();
    for (const journey of relevantJourneys) {
      const city = mapCityName(journey.destination) ?? journey.destination;
      if (!city) continue;
      names.set(city, (names.get(city) || 0) + 1);
    }
    return Array.from(names, ([name, count]) => {
      const matchingJourney = relevantJourneys.find(journey => (mapCityName(journey.destination) ?? journey.destination) === name);
      const station = matchingJourney ? stationMapPoint(matchingJourney.destination) : null;
      return station ? { ...station, name, count } : null;
    }).filter((station): station is MapStation & { count: number } => station !== null);
  }, [relevantJourneys, stationCoordinates]);

  const mapJourneys = useMemo(() => relevantJourneys.filter(journey => mode !== "classic" || (normalizeText(journey.origin) === normalizeText(origin) && normalizeText(journey.destination) === normalizeText(destination))).map(journey => {
    const names = [journey.origin, ...journey.legs.map(leg => getPlace(leg, "destination"))];
    const points = names.map(name => {
      return stationMapPoint(name);
    });
    const hasDrawableLeg = points.some((point, index) =>
      index < points.length - 1 && point !== null && points[index + 1] !== null
    );
    return { key: journey.key, points, changes: journey.changes, destinationLabel: mapCityName(journey.destination) ?? journey.destination, hasDrawableLeg };
  }).filter(journey => journey.points.length > 1 && journey.points.every(point => point !== null)).map(({ key, points, changes, destinationLabel }) => ({ key, points, changes, destinationLabel })), [relevantJourneys, stationCoordinates, mode, origin, destination]);

  const mapDestinationJourneys = useMemo(() => mapSelectedDestination
    ? relevantJourneys.filter(journey => normalizeText(mapCityName(journey.destination) ?? journey.destination) === normalizeText(mapSelectedDestination))
    : [], [relevantJourneys, mapSelectedDestination]);

  useEffect(() => {
    if (!mapExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMapExpanded(false); setMapSelectedDestination(null); setMapSelectedTripKey(null); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapExpanded]);

  function layoverMinutes(previous: TrainRecord, next: TrainRecord) {
    const arrival = minutesOfDay(getTime(previous, "arrival"));
    const departure = minutesOfDay(getTime(next, "departure"));
    if (arrival < 0 || departure < 0) return null;
    return (departure < arrival ? departure + 1440 : departure) - arrival;
  }

  async function searchTrains() {
    if (!origin) { setError("Choisis une gare de départ dans les suggestions."); return; }
    if (mode === "classic" && !destination) { setError("Choisis une gare d'arrivée dans les suggestions."); return; }
    if (returnEnabled && returnDate < outDate) { setError("La date du retour doit être égale ou postérieure à la date de l'aller."); return; }
    setLoading(true);
    setError("");
    setJourneys([]);
    setRecords([]);
    setCurrentPage(1);
    setSearchTruncated(false);
    setTruncationReasons([]);
    setReturnRecords([]);
    setSelected(null);
    setSelectedJourneyKey(null);
    setExpandedTripKey(null);
    setExpandedReturnKey(null);
    try {
      const params = new URLSearchParams({
        date: outDate, origine: origin, start: outStart, end: outEnd || "24:00",
        maxChanges, minWait, maxWait, routeType: allowConnections ? "all" : "direct"
      });
      if (mode === "classic") params.set("destination", destination);
      if (returnEnabled) {
        params.set("returnRequired", "true");
        params.set("returnDate", returnDate);
        params.set("returnStart", returnStart);
        params.set("returnEnd", returnEnd || "24:00");
      }
      const response = await fetch("/api/itineraries?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "La recherche d'itinéraires a échoué.");
      setJourneys(Array.isArray(data.routes) ? data.routes as Journey[] : []);
      setSelectedExploreDestination(null);
      setShowAllConnections(false);
      setSourceTotal(typeof data.sourceCount === "number" ? data.sourceCount : null);
      setLastFetch(data.fetched_at || new Date().toISOString());
      setSearchTruncated(Boolean(data.truncated));
      setTruncationReasons(Array.isArray(data.truncationReasons) ? data.truncationReasons.filter((reason: unknown): reason is string => typeof reason === "string") : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue pendant la recherche.");
    } finally {
      setLoading(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / RESULT_PAGE_SIZE));
  const pagedRecords = useMemo(() => filtered.slice((currentPage - 1) * RESULT_PAGE_SIZE, currentPage * RESULT_PAGE_SIZE), [filtered, currentPage]);
  const displayRecords = useMemo(() => pagedRecords, [pagedRecords]);

  return (
    <main className="min-h-screen bg-paper pb-12">
      <SiteHeader active="search"/>

      <section className="mx-auto max-w-6xl px-4 pt-7 sm:px-6 sm:pt-10">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"><Sparkles size={14}/> Open Data SNCF</div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl">Tu as TGV MAX ?<br/><span className="text-emerald-700"><span className="sm:hidden whitespace-nowrap text-[0.72em]">Pars ce week-end.</span><span className="hidden sm:inline">Trouve où partir ce week-end.</span></span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Choisis ta gare de départ et découvre les destinations TGV MAX disponibles. Ajoute un retour pour trouver des idées de week-end avec aller et retour, sans supplément sur les trains éligibles avec ton abonnement, sous réserve de disponibilité.</p>
        </div>

        <div id="recherche" className="mt-7 grid scroll-mt-4 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <section className="rounded-3xl bg-white p-4 shadow-soft sm:p-6">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button onClick={() => setMode("explore")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${mode==="explore"?"bg-white text-navy shadow":"text-slate-500"}`}><Compass size={17}/>Explorer</button>
              <button onClick={() => setMode("classic")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${mode==="classic"?"bg-white text-navy shadow":"text-slate-500"}`}><ArrowLeftRight size={17}/>Trajet classique</button>
            </div>

            <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="relative">
                <label htmlFor="origin-station" className="block text-sm font-semibold text-slate-700">Gare de départ</label>
                <input id="origin-station" type="text" role="combobox" aria-autocomplete="list" aria-expanded={originOpen && originOptions.length > 0} aria-controls="origin-station-suggestions" aria-activedescendant={originOpen && originSearch && originOptions.length ? "origin-option-" + Math.min(originActiveIndex, originOptions.length - 1) : undefined} autoComplete="off"
                  value={originSearch || (origin ? origin : "")}
                  onFocus={() => { setOriginOpen(true); if (!originSearch && origin) setOriginSearch(origin); }}
                  onChange={e => { setOriginSearch(e.target.value); setOrigin(""); setOriginActiveIndex(0); setOriginOpen(true); }}
                  onKeyDown={e => {
                    if (e.key === "Escape") setOriginOpen(false);
                    if (e.key === "ArrowDown" && originOptions.length) { e.preventDefault(); setOriginOpen(true); setOriginActiveIndex(index => Math.min(index + 1, originOptions.length - 1)); }
                    if (e.key === "ArrowUp" && originOptions.length) { e.preventDefault(); setOriginOpen(true); setOriginActiveIndex(index => Math.max(0, index - 1)); }
                    if (e.key === "Enter" && originOptions.length) { e.preventDefault(); setOrigin(originOptions[Math.min(originActiveIndex, originOptions.length - 1)]); setOriginSearch(""); setOriginOpen(false); }
                  }}
                  placeholder={stationsLoading ? "Chargement des gares…" : "Tape une gare ou une ville…"} disabled={stationsLoading || stations.origins.length === 0}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/>
                {originOpen && originSearch && <div id="origin-station-suggestions" role="listbox" className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {originOptions.length ? originOptions.map((station, index) => <button key={station} id={"origin-option-" + index} type="button" role="option" aria-selected={originActiveIndex === index} onMouseDown={e => e.preventDefault()} onClick={() => { setOrigin(station); setOriginSearch(""); setOriginOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 aria-selected:bg-emerald-50 focus:bg-emerald-50 focus:outline-none">{station}</button>) : <p className="px-3 py-2 text-sm text-slate-500">Aucune gare trouvée.</p>}
                </div>}
                <p className="mt-1 text-xs font-normal text-slate-500">{stationsLoading ? "Chargement du catalogue…" : `${stations.origins.length} gares disponibles`}</p>
                {stationsError && <p className="mt-1 text-xs font-normal text-red-700">{stationsError}</p>}
              </div>
              {mode==="classic" && <div className="relative">
                <label htmlFor="destination-station" className="block text-sm font-semibold text-slate-700">Gare d'arrivée</label>
                <input id="destination-station" type="text" role="combobox" aria-autocomplete="list" aria-expanded={destinationOpen && destinationOptions.length > 0} aria-controls="destination-station-suggestions" aria-activedescendant={destinationOpen && destinationSearch && destinationOptions.length ? "destination-option-" + Math.min(destinationActiveIndex, destinationOptions.length - 1) : undefined} autoComplete="off"
                  value={destinationSearch || (destination ? destination : "")}
                  onFocus={() => { setDestinationOpen(true); if (!destinationSearch && destination) setDestinationSearch(destination); }}
                  onChange={e => { setDestinationSearch(e.target.value); setDestination(""); setDestinationActiveIndex(0); setDestinationOpen(true); }}
                  onKeyDown={e => {
                    if (e.key === "Escape") setDestinationOpen(false);
                    if (e.key === "ArrowDown" && destinationOptions.length) { e.preventDefault(); setDestinationOpen(true); setDestinationActiveIndex(index => Math.min(index + 1, destinationOptions.length - 1)); }
                    if (e.key === "ArrowUp" && destinationOptions.length) { e.preventDefault(); setDestinationOpen(true); setDestinationActiveIndex(index => Math.max(0, index - 1)); }
                    if (e.key === "Enter" && destinationOptions.length) { e.preventDefault(); setDestination(destinationOptions[Math.min(destinationActiveIndex, destinationOptions.length - 1)]); setDestinationSearch(""); setDestinationOpen(false); }
                  }}
                  placeholder={stationsLoading ? "Chargement des gares…" : "Tape une gare ou une ville…"} disabled={stationsLoading || stations.destinations.length === 0}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/>
                {destinationOpen && destinationSearch && <div id="destination-station-suggestions" role="listbox" className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {destinationOptions.length ? destinationOptions.map((station, index) => <button key={station} id={"destination-option-" + index} type="button" role="option" aria-selected={destinationActiveIndex === index} onMouseDown={e => e.preventDefault()} onClick={() => { setDestination(station); setDestinationSearch(""); setDestinationOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none">{station}</button>) : <p className="px-3 py-2 text-sm text-slate-500">Aucune gare trouvée.</p>}
                </div>}
                <p className="mt-1 text-xs font-normal text-slate-500">{stationsLoading ? "Chargement du catalogue…" : `${stations.destinations.length} gares disponibles`}</p>
              </div>}
              <label className="block min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2"><span className="flex items-center gap-2"><CalendarDays size={15}/> Date de l'aller</span>
                <span className="mt-2 block min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <input type="date" value={outDate} onChange={e=>{const nextDate=e.target.value;setOutDate(nextDate);if(returnDate<nextDate)setReturnDate(nextDate);}} className="block min-w-0 max-w-full w-full border-0 bg-transparent px-3 py-3 font-normal outline-none"/>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <HourSelect label="Départ à partir de" value={outStart} onChange={value => { setOutStart(value); if (outEnd && hourValue(value) >= hourValue(outEnd)) setOutEnd(nextHour(value)); }}/>
                <HourSelect label="Départ jusqu’à" value={outEnd} endOfDay minExclusive={outStart} onChange={setOutEnd}/>
              </div>
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-semibold">
              <input type="checkbox" checked={returnEnabled} onChange={e=>setReturnEnabled(e.target.checked)} className="h-4 w-4 accent-emerald-700"/>
              Je veux un retour TGV MAX
            </label>
            {returnEnabled && <div className="mt-4 min-w-0 rounded-2xl bg-slate-50 p-4">
              <label className="block min-w-0 text-sm font-semibold text-slate-700">Date du retour
                <span className="mt-2 block min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <input type="date" min={outDate} value={returnDate} onChange={e=>setReturnDate(e.target.value)} className="block min-w-0 max-w-full w-full border-0 bg-transparent px-3 py-3 font-normal outline-none"/>
                </span>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <HourSelect label="Retour à partir de" value={returnStart} onChange={value => { setReturnStart(value); if (returnEnd && hourValue(value) >= hourValue(returnEnd)) setReturnEnd(nextHour(value)); }}/>
                <HourSelect label="Retour jusqu’à" value={returnEnd} endOfDay minExclusive={returnStart} onChange={setReturnEnd}/>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Les retours sont associés à chaque itinéraire selon les gares, la date et la plage horaire sélectionnées.</p>
            </div>}

            <button onClick={searchTrains} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-4 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60">
              {loading?<LoaderCircle className="animate-spin" size={18}/>:<Search size={18}/>}
              {loading?"Recherche en cours…":mode==="explore"?"Explorer les destinations":"Rechercher les trains"}
            </button>

            <div className="mt-5 rounded-2xl border border-slate-200 p-3">
              <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={allowConnections} onChange={event => setAllowConnections(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-700"/>
                <span><span className="block">Autoriser les trajets avec correspondance</span><span className="mt-1 block font-normal text-slate-500">Les trajets directs restent proposés. Cette option s’applique à l’aller et au retour.</span></span>
              </label>
              {allowConnections && <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">Correspondances max.<select value={maxChanges} onChange={e=>setMaxChanges(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
                <label className="text-sm font-semibold text-slate-700">Attente minimum (min)<input type="number" min="10" max="180" step="5" value={minWait} onChange={e=>setMinWait(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label>
                <label className="text-sm font-semibold text-slate-700">Attente maximum (min)<input type="number" min="20" max="360" step="5" value={maxWait} onChange={e=>setMaxWait(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label>
              </div>}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
              <div><h2 className="flex items-center gap-2 font-bold"><MapPinned size={18}/>Carte des destinations</h2><p className="mt-1 text-xs text-slate-500">Les étapes et correspondances du trajet sélectionné sont tracées sur la carte</p></div>
              <div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{destinations.length} ville(s)</span><button type="button" onClick={() => { setMapSelectedDestination(null); setMapSelectedTripKey(null); setMapExpanded(true); }} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100" aria-label="Agrandir la carte" title="Agrandir la carte"><Maximize2 size={20}/></button></div>
            </div>
            <div className="h-[360px] sm:h-[460px]">
              <StationMap stations={destinations} originStation={originMapStation} journeys={mapJourneys} selectedJourneyKey={selectedJourneyKey} selected={selected} onSelect={name=>{if(mode==="explore"){setMapSelectedDestination(name);setMapExpanded(true)}else{setSelected(name);setDestination(name)}}}/>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs text-slate-500">
              <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-emerald-700"/> Trajet direct</span>
              <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-amber-600"/> Trajet avec correspondance</span>
              <span className="text-slate-400">Lignes schématiques · OpenStreetMap</span>
            </div>
          </section>
        </div>

        {mapExpanded && <section role="dialog" aria-modal="true" aria-label="Carte agrandie des destinations" className="fixed inset-0 z-[2100] flex flex-col overflow-hidden bg-slate-50">
          <header className="relative z-[1200] flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div><h2 className="text-lg font-black text-slate-900">Carte des destinations</h2><p className="text-xs text-slate-600">Sélectionne une ville pour afficher ses trajets.</p></div>
            <button type="button" onClick={() => { setMapExpanded(false); setMapSelectedDestination(null); setMapSelectedTripKey(null); }} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" aria-label="Réduire la carte" title="Réduire la carte"><Minimize2 size={20}/></button>
          </header>
          <div className="relative min-h-0 flex-1">
            <StationMap stations={destinations} originStation={originMapStation} journeys={mapJourneys} selectedJourneyKey={mapSelectedTripKey} selected={mapSelectedDestination} visibleDestination={mapSelectedDestination} onSelect={name => { setMapSelectedDestination(name); setMapSelectedTripKey(null); }}/>
            <MapItinerarySheet label={mapSelectedDestination ? "Trajets vers " + mapSelectedDestination : "Destinations disponibles"}>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">MaxTrip · Carte</p>
                  <h3 className="truncate text-lg font-black text-slate-900">{mapSelectedDestination ?? "Destinations disponibles"}</h3>
                  <p className="text-xs text-slate-500">{mapSelectedDestination ? mapDestinationJourneys.length + " trajet(s)" : destinationSummaries.length + " destination(s)"}</p>
                </div>
                {mapSelectedDestination && <button type="button" onClick={() => { setMapSelectedDestination(null); setMapSelectedTripKey(null); }} className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">Retour</button>}
              </div>
              <div data-vaul-no-drag className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain touch-pan-y bg-slate-50/80 p-3" style={{ WebkitOverflowScrolling: "touch" }}>
                {!mapSelectedDestination && destinationSummaries.map(item => <button type="button" key={item.label} onClick={() => { setMapSelectedDestination(item.label); setMapSelectedTripKey(null); }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">
                  <span className="truncate text-sm font-bold text-slate-900">{item.label}</span><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{item.count} trajet(s)</span>
                </button>)}
                {mapSelectedDestination && mapDestinationJourneys.map(journey => <div key={journey.key} className={"overflow-hidden rounded-xl border bg-white shadow-sm " + (mapSelectedTripKey === journey.key ? "border-emerald-600 ring-2 ring-emerald-200" : "border-slate-200")}>
                  <button type="button" onClick={() => setMapSelectedTripKey(current => current === journey.key ? null : journey.key)} aria-expanded={mapSelectedTripKey === journey.key} className="block w-full p-3 text-left transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
                    <span className="flex items-center justify-between gap-2"><span className="font-bold tabular-nums text-slate-900">{journey.departure} → {journey.arrival}</span><span className="text-xs font-semibold text-emerald-800">{mapSelectedTripKey === journey.key ? "Masquer −" : "Détails +"}</span></span>
                    <span className="mt-1 block text-xs text-slate-600">{journey.changes === 0 ? "Trajet direct" : "Trajet avec " + journey.changes + " correspondance(s)"} · {Math.floor(journey.durationMinutes / 60)} h {String(journey.durationMinutes % 60).padStart(2, "0")}</span>
                  </button>
                  {mapSelectedTripKey === journey.key && <div className="space-y-2 border-t border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="text-xs font-bold text-emerald-900">Détail de l'itinéraire</p>
                    {journey.legs.map((leg, index) => <div key={journey.key + "-leg-" + index} className="rounded-lg border border-emerald-100 bg-white p-2.5">
                      <p className="text-[11px] font-semibold uppercase text-emerald-800">Train {index + 1}{getField(leg, ["train_no", "train_number"]) && " · N° " + getField(leg, ["train_no", "train_number"])}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-900">{getPlace(leg, "origin")} → {getPlace(leg, "destination")}</p>
                      <p className="mt-1 text-xs text-slate-600">{getTime(leg, "departure")} → {getTime(leg, "arrival")}</p>
                      {index < journey.legs.length - 1 && <p className="mt-2 text-xs font-medium text-amber-800">Correspondance à {getPlace(leg, "destination")} · {(() => { const gap = layoverMinutes(leg, journey.legs[index + 1]); return gap === null ? "attente non calculée" : Math.floor(gap / 60) + " h " + String(gap % 60).padStart(2, "0") + " d'attente"; })()}</p>}
                    </div>)}
                    <button type="button" onClick={() => { returnToMapRef.current = true; setMapExpanded(false); openDestinationDetails(mapCityName(journey.destination) ?? journey.destination); setSelectedJourneyKey(journey.key); setExpandedTripKey(journey.key); }} className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">{returnEnabled ? "Voir le trajet et les retours compatibles" : "Voir le détail du trajet"}</button>
                  </div>}
                </div>)}
              </div>
              {mapSelectedTripKey && <button type="button" onClick={() => setMapSelectedTripKey(null)} className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Afficher tous les trajets sur la carte</button>}
            </MapItinerarySheet>
          </div>
        </section>}

        {mode === "explore" && journeys.length > 0 && <section aria-label="Destinations possibles" className="mt-6 rounded-3xl bg-white p-4 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Destinations possibles depuis {origin}</h2>
              <p className="mt-1 text-sm text-slate-500">Nombre de trajets distincts utiles affichés avec les critères choisis.</p>
            </div>
            {selectedExploreDestination && <button type="button" onClick={closeDestinationDetails} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Toutes les destinations</button>}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {destinationSummaries.map(item => <button key={item.label} type="button" onClick={() => selectedExploreDestination === item.label ? closeDestinationDetails() : openDestinationDetails(item.label)}
              aria-pressed={selectedExploreDestination === item.label}
              className={"rounded-2xl border p-4 text-left transition " + (selectedExploreDestination === item.label ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50")}>
              <span className="flex items-center justify-between gap-3"><span className="font-bold">{item.label}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{item.count}</span></span>
              <span className="mt-2 block text-sm font-semibold text-emerald-800">Voir les trajets <span aria-hidden="true">→</span></span>
            </button>)}
          </div>
        </section>}

        {mode === "explore" && !selectedExploreDestination && error && <div role="alert" className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert size={18} className="mt-0.5 shrink-0"/>{error}</div>}
        {mode === "explore" && !selectedExploreDestination && searchTruncated && <p role="status" className="mt-3 text-xs text-slate-600">Résultats disponibles affichés · recherche non exhaustive. D’autres trajets peuvent exister.</p>}

        <section
          id="search-results"
          aria-label={mode === "explore" && selectedExploreDestination ? "Itinéraires pour " + selectedExploreDestination : "Résultats de recherche"}
          role={mode === "explore" && selectedExploreDestination ? "dialog" : undefined}
          aria-modal={mode === "explore" && selectedExploreDestination ? true : undefined}
          className={
            mode === "explore" && !selectedExploreDestination
              ? "hidden"
              : mode === "explore" && selectedExploreDestination
                ? "fixed inset-0 z-[2000] overflow-y-auto overscroll-contain bg-slate-950/50 p-0 sm:p-6"
                : "mt-6 scroll-mt-4"
          }
          onClick={event => {
            if (mode === "explore" && selectedExploreDestination && event.target === event.currentTarget) {
              closeDestinationDetails();
            }
          }}
        >
          <div className={mode === "explore" && selectedExploreDestination ? "mx-auto min-h-dvh max-w-5xl rounded-none bg-paper p-4 shadow-2xl sm:my-6 sm:min-h-0 sm:rounded-3xl sm:p-6" : ""}>
            {mode === "explore" && selectedExploreDestination && <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="min-w-0">
                <button type="button" onClick={closeDestinationDetails} className="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
                  <ArrowLeft size={16}/> Toutes les destinations
                </button>
                <h2 className="text-xl font-black sm:text-2xl">{origin} <span className="text-slate-400">→</span> {selectedExploreDestination}</h2>
                <p className="mt-1 text-sm text-slate-600">{new Date(outDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {filtered.length} itinéraire(s) distinct(s)</p>
                {allowConnections && <p className="mt-2 text-xs text-slate-500">Certains trajets avec correspondance sont masqués lorsqu’un trajet direct comparable arrive plus tôt ou à la même heure, même s’il part plus tard.</p>}
                {returnEnabled && <p className="mt-1 text-xs font-medium text-emerald-800">Retour TGV MAX demandé · {new Date(returnDate + "T12:00:00").toLocaleDateString("fr-FR")}</p>}
              </div>
              <button type="button" aria-label="Fermer le détail de la destination" onClick={closeDestinationDetails} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                <X size={20}/>
              </button>
            </div>}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-black">Résultats de recherche</h2><p className="mt-1 text-sm text-slate-500">{lastFetch? `Dernière réponse API : ${new Date(lastFetch).toLocaleString("fr-FR")}` : "Lance une recherche pour récupérer les données publiées."}</p></div>
            {lastFetch && <button onClick={searchTrains} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/> Actualiser</button>}
          </div>

          {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert size={18} className="mt-0.5 shrink-0"/>{error}</div>}
          {lastFetch && <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">{filtered.length} itinéraire(s) trouvé(s) · affichage de {RESULT_PAGE_SIZE} résultats par page.{selectedExploreDestination ? " Destination : " + selectedExploreDestination + "." : ""}</p>
            {allowConnections && suppressedConnectionCount > 0 && <button type="button" onClick={() => { setShowAllConnections(value => !value); setCurrentPage(1); }} className="rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:border-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              {(showAllConnections ? "Masquer les alternatives moins pertinentes" : "Afficher aussi les autres trajets avec correspondance") + " (" + suppressedConnectionCount + ")"}
            </button>}
          </div>}
          {searchTruncated && <p role="status" className="mt-3 text-xs text-slate-600">Résultats disponibles affichés · recherche non exhaustive. D’autres trajets peuvent exister.</p>}
          {lastFetch && <p className="mt-2 text-xs text-slate-500">Les trajets directs et les trajets avec correspondance sont construits à partir des trains MAX signalés disponibles. Les durées de changement de gare inconnues ne sont pas inventées.</p>}

          {lastFetch && <div className="mt-4 grid gap-3">
            {displayRecords.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Aucun trajet trouvé avec ces critères. Essaie une autre date ou une plage horaire plus large.</div>}
            {displayRecords.map((journey, index) => {
              const from = journey.origin;
              const to = journey.destination;
              const dep = journey.departure;
              const arr = journey.arrival;
              const tripKey = journey.key;
              const isExpanded = expandedTripKey === tripKey;
              const areReturnsExpanded = expandedReturnKey === tripKey;
              const matchingReturns = journey.returns ?? [];
              const journeyDateLabel = new Date(outDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
              const finalCity = mapCityName(to);
              return <article key={tripKey + "-" + index} className={"rounded-2xl border bg-white p-4 shadow-sm sm:p-5 " + (selectedJourneyKey === tripKey ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold"><TrainFront size={17} className="text-emerald-700"/>{from} <span className="text-slate-400">→</span> {to}</div>
                  <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold " + (journey.changes === 0 ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950")}>{journey.changes === 0 ? <TrainFront size={14}/> : <GitBranch size={14}/>} {journey.changes === 0 ? "Trajet direct" : "Trajet avec " + journey.changes + " correspondance(s)"} · MAX signalé disponible</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500"><CalendarDays size={13} className="mr-1 inline-block"/>{journeyDateLabel}</p>
                <div className="mt-3 grid grid-cols-3 items-center gap-2">
                  <div><div className="text-2xl font-black">{dep}</div><div className="mt-1 text-xs text-slate-500">Départ</div></div>
                  <div className="text-center text-xs text-slate-500"><div className="mx-auto mb-2 h-px bg-slate-200"/><Clock3 size={15} className="mx-auto mb-1"/>{Math.floor(journey.durationMinutes / 60)} h {String(journey.durationMinutes % 60).padStart(2, "0")}</div>
                  <div className="text-right"><div className="text-2xl font-black">{arr}</div><div className="mt-1 text-xs text-slate-500">Arrivée</div></div>
                </div>
                {journey.legs.length > 1 && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">{journey.legs.slice(0, -1).map((leg, legIndex) => {
                  const gap = layoverMinutes(leg, journey.legs[legIndex + 1]);
                  return <span key={getTripKey(leg)} className="rounded-full bg-amber-50 px-3 py-1">Changement à {getPlace(leg, "destination")} · attente {gap === null ? "n.c." : Math.floor(gap / 60) + " h " + String(gap % 60).padStart(2, "0")}</span>;
                })}</div>}
                <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => { setExpandedTripKey(isExpanded ? null : tripKey); setSelectedJourneyKey(isExpanded ? null : tripKey); setSelected(finalCity); }}
                  aria-expanded={isExpanded} aria-controls={"details-" + index} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50">
                  <span>{isExpanded ? "Masquer le détail de l’itinéraire" : "Voir le détail de l’itinéraire"}</span><span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                </button>
                {returnEnabled && <button type="button" onClick={() => setExpandedReturnKey(areReturnsExpanded ? null : tripKey)} aria-expanded={areReturnsExpanded} aria-controls={"returns-" + index} className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-bold text-emerald-900 transition hover:bg-emerald-100"><span>{areReturnsExpanded ? "Masquer " : "Voir "}{matchingReturns.length === 1 ? "le retour compatible" : "les " + matchingReturns.length + " retours compatibles"}</span><span aria-hidden="true">{areReturnsExpanded ? "−" : "+"}</span></button>}
                </div>
                {isExpanded && <div id={"details-" + index} className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <h3 className="font-bold text-slate-900">Détail de l'itinéraire</h3>
                  <div className="mt-3 grid gap-3">{journey.legs.map((leg, legIndex) => {
                    const legFrom = getPlace(leg, "origin");
                    const legTo = getPlace(leg, "destination");
                    const trainNo = getField(leg, ["train_no", "train_number"]);
                    return <div key={getTripKey(leg) + "-" + legIndex} className="rounded-xl border border-emerald-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Train {legIndex + 1}</span>{trainNo && <span className="text-xs text-slate-500">N° {trainNo}</span>}</div>
                      <p className="mt-1 font-bold">{legFrom} <span className="text-slate-400">→</span> {legTo}</p>
                      <p className="mt-1 text-sm">{formatTime(getTime(leg, "departure"))} → {formatTime(getTime(leg, "arrival"))}</p>
                      {legIndex < journey.legs.length - 1 && <p className="mt-2 text-xs font-medium text-amber-800">Correspondance à {legTo} · {(() => { const gap = layoverMinutes(leg, journey.legs[legIndex + 1]); return gap === null ? "attente non calculée" : Math.floor(gap / 60) + " h " + String(gap % 60).padStart(2, "0") + " d'attente"; })()}</p>}
                    </div>;
                  })}</div>
                  <a href="https://www.sncf-connect.com/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 underline underline-offset-4">Vérifier l'aller sur SNCF Connect <ExternalLink size={14}/></a>
                </div>}
                {returnEnabled && areReturnsExpanded && <div id={"returns-" + index} className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <h3 className="font-bold text-slate-900">Retours compatibles</h3>
                  {returnEnabled
                    ? matchingReturns.length
                      ? <div className="mt-3 grid gap-3">{matchingReturns.map((back, backIndex) => <div key={back.key + "-" + backIndex} className="rounded-xl border border-emerald-100 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{back.origin} <span className="text-slate-400">→</span> {back.destination}</p><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">{back.changes === 0 ? "Trajet direct" : "Trajet avec " + back.changes + " correspondance(s)"}</span></div>
                        <p className="mt-2 text-sm">{back.departure} → {back.arrival} · {new Date(returnDate + "T12:00:00").toLocaleDateString("fr-FR")}</p>
                        <div className="mt-2 grid gap-2">{back.legs.map((leg, backLegIndex) => <p key={getTripKey(leg) + "-" + backLegIndex} className="text-sm text-slate-600">{formatTime(getTime(leg, "departure"))} {getPlace(leg, "origin")} → {formatTime(getTime(leg, "arrival"))} {getPlace(leg, "destination")}</p>)}</div>
                        <a href="https://www.sncf-connect.com/" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline">Vérifier ce retour sur SNCF Connect <ExternalLink size={13}/></a>
                      </div>)}</div>
                      : <p className="mt-2 text-sm text-slate-600">Aucun retour ne remplit les critères de date, horaire et correspondance pour cette destination.</p>
                    : <p className="mt-2 text-sm text-slate-600">Active le retour obligatoire et choisis sa date et ses horaires pour afficher les retours compatibles.</p>}
                </div>}
              </article>;
            })}
          </div>}
          {pageCount > 1 && <nav aria-label="Pagination des itinéraires" className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => { setCurrentPage(page => Math.max(1, page - 1)); document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} disabled={currentPage === 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Précédent</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => <button key={pageNumber} type="button" aria-current={currentPage === pageNumber ? "page" : undefined} onClick={() => { setCurrentPage(pageNumber); document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={"min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold " + (currentPage === pageNumber ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{pageNumber}</button>)}
            <button type="button" onClick={() => { setCurrentPage(page => Math.min(pageCount, page + 1)); document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} disabled={currentPage === pageCount} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Suivant</button>
          </nav>}
          <p className="mt-3 text-center text-xs text-slate-500">Page {currentPage} sur {pageCount} · {filtered.length} itinéraire(s)</p>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          <p className="font-semibold text-slate-700">MaxTrip est un projet indépendant.</p>
          <p className="mt-1">Les données proviennent de l'Open Data SNCF et peuvent être différées ou incomplètes. MaxTrip n'est pas affilié à la SNCF. Les disponibilités doivent être confirmées auprès du vendeur avant tout voyage.</p>
        </footer>
      </section>
    </main>
  );
}
