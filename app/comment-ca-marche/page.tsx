import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Database, GitBranch, MapPinned, Search, ShieldAlert, TrainFront } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

const steps = [
  { number: "01", icon: Search, title: "Choisis ta recherche", body: "Avec Explorer, découvre où partir depuis ta gare. Avec Trajet classique, indique aussi ta destination. Choisis la date et la plage horaire de départ. Sans heure de fin, la recherche va jusqu’à la fin de la journée." },
  { number: "02", icon: CalendarDays, title: "Ajoute tes options", body: "Active les trajets avec correspondance pour élargir les possibilités. Si tu veux un retour TGV MAX, coche l’option et indique sa date et ses horaires avant de rechercher." },
  { number: "03", icon: MapPinned, title: "Compare les trajets trouvés", body: "Ouvre une destination depuis la carte ou la liste. Compare les horaires, la durée, les changements et les retours proposés. Vert : trajet direct. Orange : trajet avec correspondance. Les compteurs portent sur les trajets trouvés avec tes filtres." },
  { number: "04", icon: TrainFront, title: "Vérifie et réserve", body: "MaxTrip propose des possibilités de voyage, mais ne réserve pas de billet. Vérifie les horaires, les gares et la disponibilité sur SNCF Connect, puis réserve les trains nécessaires pour l’aller et le retour." }
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
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Découvre comment rechercher, comparer et vérifier tes trajets TGV MAX.</p>
        </div>

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

        <section aria-labelledby="connection-rule" className="mt-8 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
              <GitBranch size={21} aria-hidden="true"/>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">La règle de pertinence</p>
              <h2 id="connection-rule" className="mt-1 text-xl font-black text-emerald-950">Pourquoi certains trajets avec correspondance sont masqués&nbsp;?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-950/75">Une option avec correspondance peut être masquée par défaut lorsqu’un trajet direct comparable arrive plus tôt ou à la même heure. « Afficher aussi les autres trajets avec correspondance » réaffiche les alternatives trouvées.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/70 p-4"><p className="font-bold text-emerald-950">1. Même destination</p><p className="mt-1 text-sm leading-5 text-emerald-950/70">Les trajets sont comparés uniquement s’ils arrivent à la même gare.</p></div>
            <div className="rounded-2xl border border-white/80 bg-white/70 p-4"><p className="font-bold text-emerald-950">2. Trajet direct proche</p><p className="mt-1 text-sm leading-5 text-emerald-950/70">Le trajet direct part au maximum 60 minutes avant ou après le trajet avec correspondance et arrive plus tôt ou à la même heure.</p></div>
            <div className="rounded-2xl border border-white/80 bg-white/70 p-4"><p className="font-bold text-emerald-950">3. Retour préservé</p><p className="mt-1 text-sm leading-5 text-emerald-950/70">Si un retour est demandé, le trajet direct doit également avoir un retour compatible.</p></div>
          </div>
          <p className="mt-4 text-sm leading-6 text-emerald-950">Exemple : trajet direct 10 h 38 → 13 h 41 ; trajet avec correspondance 10 h 38 → 14 h 41. Le second est masqué par défaut, mais reste accessible. Cela ne garantit pas que toutes les possibilités SNCF ont été chargées.</p>
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="data-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-navy"><Database size={21} aria-hidden="true"/></div>
              <div>
                <h2 id="data-heading" className="text-xl font-black">D’où viennent les données&nbsp;?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">MaxTrip utilise le jeu de données TGVmax de l’Open Data SNCF, actualisé quotidiennement. Il s’agit de disponibilités signalées, pas d’un accès direct aux réservations.</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-5 text-slate-600">
              <li className="flex gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true"/>Chaque trajet affiché est construit à partir de segments marqués disponibles dans la source.</li>
              <li className="flex gap-2"><Clock3 size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true"/>Les horaires, durées et temps de correspondance sont calculés à partir de ces segments.</li>
              <li className="flex gap-2"><TrainFront size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true"/>Vérifie toujours le trajet et la place sur SNCF Connect avant de partir.</li>
            </ul>
          </section>

          <section aria-labelledby="limits-heading" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-amber-800"><ShieldAlert size={21} aria-hidden="true"/></div>
              <div>
                <h2 id="limits-heading" className="text-xl font-black text-amber-950">Quand les résultats peuvent manquer</h2>
                <p className="mt-2 text-sm leading-6 text-amber-950/75">Le catalogue SNCF est chargé par pages et le moteur applique des limites de temps, de volume et de sécurité.</p>
              </div>
            </div>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-5 text-amber-950/80">
              <li>Si une limite est atteinte ou si une page secondaire ne répond pas, MaxTrip affiche un message de recherche partielle.</li>
              <li>La pagination parcourt les itinéraires déjà chargés ; elle ne récupère pas les données qui n’ont pas pu être chargées.</li>
              <li>Les changements de gare sont proposés lorsqu’une marge de transfert est calculable. Cette marge ne garantit pas la réussite du changement.</li>
            </ul>
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
