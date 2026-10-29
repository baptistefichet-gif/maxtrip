import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Database, GitBranch, MapPinned, Search, ShieldAlert, TrainFront } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

const steps = [
  { number: "01", icon: Search, title: "Choisis une gare et une date", body: "Indique ta gare de départ et ton jour de voyage. Avec Explorer, découvre les destinations TGV MAX trouvées depuis cette gare, sans avoir à les chercher une par une. Tu peux aussi choisir une arrivée précise avec Trajet classique." },
  { number: "02", icon: CalendarDays, title: "Prépare ton aller-retour", body: "Choisis tes horaires et, si tu veux revenir, ajoute une date de retour. MaxTrip recherche les destinations pour lesquelles il trouve un aller et un retour compatibles, pratique pour partir en week-end." },
  { number: "03", icon: MapPinned, title: "Explore la carte et les trajets", body: "Repère sur la carte les destinations trouvées, puis compare les horaires. Tu peux voir les trajets directs ou autoriser les trajets avec correspondance : MaxTrip combine alors des trains TGV MAX disponibles pour proposer d’autres possibilités, même si aucun direct disponible n’a été trouvé." },
  { number: "04", icon: TrainFront, title: "Vérifie et réserve", body: "Tu as trouvé un trajet qui te plaît ? Vérifie sa disponibilité sur SNCF Connect et réserve tes billets. MaxTrip t’aide à chercher, mais ne vend pas de billets." }
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-paper pb-12">
      <SiteHeader active="help"/>

      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Link href="/#recherche" className="inline-flex items-center gap-2 rounded-lg text-sm font-bold text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700">
          <ArrowLeft size={16} aria-hidden="true"/> Retour à la recherche
        </Link>
        <div className="mt-6 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Guide MaxTrip · 4 étapes</p>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl">Comment ça marche&nbsp;?</h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Choisis une gare, découvre où partir avec TGV MAX et trouve un retour compatible pour organiser ton prochain week-end.</p>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5"><h2 className="text-lg font-black text-emerald-950">Une envie de voyager ?</h2><p className="mt-2 text-sm leading-6 text-emerald-950">Choisis simplement une gare de départ pour découvrir où voyager. Pour un week-end, cherche un aller le vendredi et un retour le dimanche : MaxTrip te montre les destinations avec des trajets compatibles. Avec ton abonnement, les trains TGV MAX éligibles sont sans supplément, sous réserve de disponibilité.</p></div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {steps.map(({ number, icon: Icon, title, body }) => (
            <article key={number} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
              <span aria-hidden="true" className="absolute right-5 top-3 text-5xl font-black tracking-tighter text-slate-100">{number}</span>
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <Icon size={23} aria-hidden="true"/>
                </div>
                
                <h2 className="mt-2 text-xl font-black text-ink">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
                
              </div>
            </article>
          ))}
        </div>

        <section aria-labelledby="connection-rule" className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <GitBranch size={24} className="mt-1 shrink-0 text-emerald-700" aria-hidden="true"/>
            <div>
              <h2 id="connection-rule" className="text-xl font-black text-emerald-950">Pourquoi certains trajets avec correspondance ne s’affichent pas tout de suite&nbsp;?</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-950">Si un trajet direct vers la même gare permet de partir plus tard et d’arriver plus tôt, MaxTrip le privilégie. Les autres trajets avec correspondance restent accessibles avec le bouton des alternatives.</p>
              <p className="mt-2 text-sm leading-6 text-emerald-950">Si tu as demandé un retour, MaxTrip tient aussi compte des retours disponibles.</p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="data-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-navy"><Database size={21} aria-hidden="true"/></div>
              <div>
                <h2 id="data-heading" className="text-xl font-black">D’où viennent les données&nbsp;?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">MaxTrip utilise les informations de disponibilité TGV MAX publiées par la SNCF. Les places peuvent évoluer entre ta recherche et ta réservation.</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Les places affichées sont indicatives et peuvent changer. Vérifie toujours la disponibilité avant de réserver.</p>
          </section>

          <section aria-labelledby="limits-heading" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-amber-800"><ShieldAlert size={21} aria-hidden="true"/></div>
              <div>
                <h2 id="limits-heading" className="text-xl font-black text-amber-950">À savoir sur les disponibilités</h2>
                <p className="mt-2 text-sm leading-6 text-amber-950/75">MaxTrip affiche les trajets qu’il trouve dans les données SNCF.</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-amber-950/80">Les disponibilités évoluent et certaines recherches ne couvrent pas tous les trajets. Vérifie toujours ton voyage sur SNCF Connect.</p>
          </section>
        </div>

        <p className="mt-7 text-xs leading-5 text-slate-500">MaxTrip est un projet indépendant et n’est pas affilié à la SNCF. Les disponibilités doivent toujours être confirmées auprès du vendeur.</p>
        <Link href="/#recherche" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700">
          <CheckCircle2 size={18} aria-hidden="true"/> Commencer une recherche
        </Link>
      </section>
    </main>
  );
}
