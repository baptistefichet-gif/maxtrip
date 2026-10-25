"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Clock3, Compass, ExternalLink, GitBranch, MapPinned, Search, TrainFront, SlidersHorizontal, Sparkles, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import type { MapStation } from "@/components/StationMap";

const StationMap = dynamic(() => import("@/components/StationMap"), {
  ssr: false,
  loading: () => <div className="flex min-h-[340px] items-center justify-center bg-slate-100 text-sm text-slate-500">Chargement de la carte…</div>
});

type TrainRecord = Record<string, unknown>;
type SearchMode = "explore" | "classic";
type RouteType = "all" | "direct" | "indirect";

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
  { name: "Nîmes", lat: 43.8367, lon: 4.3601 }
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
  if (!value) return "Horaire non fourni";
  const match = value.match(/(\\d{1,2})[:hH]?(\\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value;
}

function isAvailable(record: TrainRecord) {
  const value = getField(record, ["od_happy_card", "disponibilite", "available", "tgvmax"]);
  return ["oui", "yes", "true", "1", "disponible"].includes(value.toLowerCase());
}

export default function HomePage() {
  const [mode, setMode] = useState<SearchMode>("explore");
  const [origin, setOrigin] = useState("Paris");
  const [destination, setDestination] = useState("Lyon");
  const [outDate, setOutDate] = useState(todayString());
  const [returnEnabled, setReturnEnabled] = useState(false);
  const [returnDate, setReturnDate] = useState(todayString());
  const [outStart, setOutStart] = useState("08:00");
  const [outEnd, setOutEnd] = useState("23:00");
  const [returnStart, setReturnStart] = useState("08:00");
  const [returnEnd, setReturnEnd] = useState("23:00");
  const [routeType, setRouteType] = useState<RouteType>("all");
  const [maxChanges, setMaxChanges] = useState("1");
  const [minWait, setMinWait] = useState("20");
  const [maxWait, setMaxWait] = useState("90");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<TrainRecord[]>([]);
  const [lastFetch, setLastFetch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [returnRecords, setReturnRecords] = useState<TrainRecord[]>([]);

  const filtered = useMemo(() => records.filter(record => {
    const from = getPlace(record, "origin").toLocaleLowerCase("fr");
    const to = getPlace(record, "destination").toLocaleLowerCase("fr");
    if (!from || !to) return false;
    if (routeType === "direct" && maxChanges !== "0") {
      // Each record is a single observed segment; this result is still direct for the requested origin/destination.
    }
    if (!isAvailable(record)) return false;
    const dep = formatTime(getTime(record, "departure"));
    return dep >= outStart && dep <= outEnd;
  }), [records, routeType, maxChanges, outStart, outEnd]);

  const destinations = useMemo(() => {
    const names = new Map<string, number>();
    for (const record of filtered) {
      const from = getPlace(record, "origin").toLocaleLowerCase("fr");
      const to = getPlace(record, "destination");
      if (mode === "classic" && from !== origin.toLocaleLowerCase("fr")) continue;
      if (mode === "classic" && to.toLocaleLowerCase("fr") !== destination.toLocaleLowerCase("fr")) continue;
      names.set(to, (names.get(to) || 0) + 1);
    }
    const coords = new Map(INITIAL_STATIONS.map(s => [s.name.toLocaleLowerCase("fr"), s]));
    return Array.from(names).flatMap(([name, count]) => {
      const station = coords.get(name.toLocaleLowerCase("fr"));
      return station ? [{ ...station, count }] : [];
    });
  }, [filtered, mode, origin, destination]);

  async function searchTrains() {
    setLoading(true);
    setError("");
    setRecords([]);
    setReturnRecords([]);
    setSelected(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (mode === "classic") params.set("destination", destination);
      params.set("origine", origin);
      params.set("date", outDate);
      const response = await fetch(`/api/trains?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Recherche indisponible.");
      const results = Array.isArray(data.results) ? data.results as TrainRecord[] : [];
      setRecords(results);
      setLastFetch(data.fetched_at || new Date().toISOString());
      if (returnEnabled) {
        const backParams = new URLSearchParams({ limit: "100", date: returnDate });
        if (mode === "classic") backParams.set("destination", origin);
        backParams.set("origine", mode === "classic" ? destination : origin);
        const backResponse = await fetch(`/api/trains?${backParams.toString()}`);
        const backData = await backResponse.json();
        if (backResponse.ok && Array.isArray(backData.results)) setReturnRecords(backData.results as TrainRecord[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  const displayRecords = useMemo(() => filtered.filter(r => {
    if (mode === "classic") {
      return getPlace(r, "origin").toLocaleLowerCase("fr") === origin.toLocaleLowerCase("fr")
        && getPlace(r, "destination").toLocaleLowerCase("fr") === destination.toLocaleLowerCase("fr");
    }
    return getPlace(r, "origin").toLocaleLowerCase("fr") === origin.toLocaleLowerCase("fr");
  }), [filtered, mode, origin, destination]);

  return (
    <main className="min-h-screen bg-paper pb-12">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-navy"><TrainFront size={25}/></div>
            <div><div className="text-xl font-black tracking-tight">MaxTrip</div><div className="text-xs text-slate-300">Les voyages MAX à portée de main</div></div>
          </div>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-100">Bêta privée</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-7 sm:px-6 sm:pt-10">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"><Sparkles size={14}/> Open Data SNCF</div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl">Pars où tu veux.<br/><span className="text-emerald-700">Cherche ton trajet MAX.</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Explore les destinations annoncées disponibles ou cherche un itinéraire précis, avec ou sans retour.</p>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <section className="rounded-3xl bg-white p-4 shadow-soft sm:p-6">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button onClick={() => setMode("explore")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${mode==="explore"?"bg-white text-navy shadow":"text-slate-500"}`}><Compass size={17}/>Explorer</button>
              <button onClick={() => setMode("classic")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${mode==="classic"?"bg-white text-navy shadow":"text-slate-500"}`}><ArrowLeftRight size={17}/>Trajet classique</button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Gare ou ville de départ
                <input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Ex. Paris" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-600"/>
              </label>
              {mode==="classic" && <label className="block text-sm font-semibold text-slate-700">Gare ou ville d'arrivée
                <input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Ex. Lyon" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-600"/>
              </label>}
              <label className="block text-sm font-semibold text-slate-700"><span className="flex items-center gap-2"><CalendarDays size={15}/> Date de l'aller</span>
                <input type="date" value={outDate} onChange={e=>setOutDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal"/>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-semibold text-slate-700">Départ après
                  <input type="time" value={outStart} onChange={e=>setOutStart(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-2 py-3 font-normal"/>
                </label>
                <label className="block text-sm font-semibold text-slate-700">Départ avant
                  <input type="time" value={outEnd} onChange={e=>setOutEnd(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-2 py-3 font-normal"/>
                </label>
              </div>
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-semibold">
              <input type="checkbox" checked={returnEnabled} onChange={e=>setReturnEnabled(e.target.checked)} className="h-4 w-4 accent-emerald-700"/>
              Retour MAX disponible obligatoire
            </label>
            {returnEnabled && <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <label className="block text-sm font-semibold text-slate-700">Date du retour
                <input type="date" min={outDate} value={returnDate} onChange={e=>setReturnDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"/>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm font-semibold text-slate-700">Retour après<input type="time" value={returnStart} onChange={e=>setReturnStart(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-2 py-3 font-normal"/></label>
                <label className="block text-sm font-semibold text-slate-700">Retour avant<input type="time" value={returnEnd} onChange={e=>setReturnEnd(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-2 py-3 font-normal"/></label>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Le retour est interrogé séparément. Le moteur d'association aller-retour complet reste à valider.</p>
            </div>}

            <button onClick={searchTrains} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-4 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60">
              {loading?<LoaderCircle className="animate-spin" size={18}/>:<Search size={18}/>}
              {loading?"Recherche en cours…":mode==="explore"?"Explorer les destinations":"Rechercher les trains"}
            </button>

            <button onClick={()=>setShowAdvanced(v=>!v)} className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-slate-600"><SlidersHorizontal size={16}/> {showAdvanced?"Masquer":"Afficher"} les filtres avancés</button>
            {showAdvanced && <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Type de trajet<select value={routeType} onChange={e=>setRouteType(e.target.value as RouteType)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"><option value="all">Tous</option><option value="direct">Direct uniquement</option><option value="indirect">Avec correspondance</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Correspondances max.<select value={maxChanges} onChange={e=>setMaxChanges(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Attente minimum (min)<input type="number" min="10" max="120" step="5" value={minWait} onChange={e=>setMinWait(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label>
              <label className="text-sm font-semibold text-slate-700">Attente maximum (min)<input type="number" min="20" max="360" step="5" value={maxWait} onChange={e=>setMaxWait(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label>
            </div>}
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
              <div><h2 className="flex items-center gap-2 font-bold"><MapPinned size={18}/>Carte des destinations</h2><p className="mt-1 text-xs text-slate-500">Sélectionne une ville pour visualiser ses liaisons</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{destinations.length} ville(s)</span>
            </div>
            <div className="h-[360px] sm:h-[460px]">
              <StationMap stations={destinations.length ? destinations : INITIAL_STATIONS} selected={selected} onSelect={name=>{setSelected(name);if(mode==="classic")setDestination(name)}}/>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-700"/> Liaisons schématiques en lignes droites · carte OpenStreetMap</div>
          </section>
        </div>

        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-black">Résultats de recherche</h2><p className="mt-1 text-sm text-slate-500">{lastFetch? `Dernière réponse API : ${new Date(lastFetch).toLocaleString("fr-FR")}` : "Lance une recherche pour récupérer les données publiées."}</p></div>
            {lastFetch && <button onClick={searchTrains} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/> Actualiser</button>}
          </div>

          {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert size={18} className="mt-0.5 shrink-0"/>{error}</div>}
          {lastFetch && !error && <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><CircleAlert size={15} className="mt-0.5 shrink-0"/>Les enregistrements Open Data ne constituent pas une confirmation de réservation. Les champs et disponibilités doivent encore être validés sur les données réelles.</div>}

          {lastFetch && <div className="mt-4 grid gap-3">
            {displayRecords.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Aucun résultat ne correspond aux champs actuellement reconnus. Cela peut signifier qu'il faut adapter le mapping aux noms de champs exacts du jeu SNCF. Aucun itinéraire n'est inventé.</div>}
            {displayRecords.map((record, index) => {
              const from = getPlace(record,"origin");
              const to = getPlace(record,"destination");
              const dep = formatTime(getTime(record,"departure"));
              const arr = formatTime(getTime(record,"arrival"));
              return <article key={`${from}-${to}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold"><TrainFront size={17} className="text-emerald-700"/>{from} <span className="text-slate-400">→</span> {to}</div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">MAX signalé disponible</span>
                </div>
                <div className="mt-4 grid grid-cols-3 items-center gap-2">
                  <div><div className="text-2xl font-black">{dep}</div><div className="mt-1 text-xs text-slate-500">Départ</div></div>
                  <div className="text-center text-xs text-slate-500"><div className="mx-auto mb-2 h-px bg-slate-200"/><Clock3 size={15} className="mx-auto mb-1"/>Horaires publiés</div>
                  <div className="text-right"><div className="text-2xl font-black">{arr}</div><div className="mt-1 text-xs text-slate-500">Arrivée</div></div>
                </div>
                <a href="https://www.sncf-connect.com/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 underline underline-offset-4">Vérifier et réserver sur SNCF Connect <ExternalLink size={14}/></a>
              </article>;
            })}
          </div>}

          {returnEnabled && lastFetch && <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-bold">Vérification des retours ({returnRecords.length} enregistrement(s))</summary><p className="mt-2 text-sm text-slate-600">Les retours ont été interrogés séparément ; l'association exacte de chaque destination à ses retours et le filtrage de la plage horaire du retour restent à terminer avant usage voyage.</p></details>}
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          <p className="font-semibold text-slate-700">MaxTrip est un projet indépendant.</p>
          <p className="mt-1">Les données proviennent de l'Open Data SNCF et peuvent être différées ou incomplètes. MaxTrip n'est pas affilié à la SNCF. Les disponibilités doivent être confirmées auprès du vendeur avant tout voyage.</p>
        </footer>
      </section>
    </main>
  );
}
