import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Database, GitBranch, MapPinned, Search, ShieldAlert, TrainFront } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Paramètre ta recherche",
    body: "Choisis Explorer pour voir les destinations accessibles depuis une gare, ou Trajet classique pour viser une destination précise. Sélectionne ensuite la date et l’heure de départ.",
    takeaway: "La fin de la plage est facultative : sans heure limite, MaxTrip cherche jusqu’à la fin de la journée."
  },
  {
    number: "02",
    icon: MapPinned,
    title: "Explore les destinations",
    body: "Après la recherche, MaxTrip regroupe les itinéraires distincts qu’il a réellement construits à partir des données chargées. Ouvre une destination depuis la carte ou la liste pour voir ses trajets.",
    takeaway: "Un compteur correspond aux itinéraires construits, pas à une promesse d’exhaustivité lorsque la source est limitée."
  },
  {
    number: "03",
    icon: GitBranch,
    title: "Compare directs et correspondances",
    body: "Un direct ne comporte aucun changement. Un trajet avec correspondance comporte une ou plusieurs étapes, avec un temps de transfert contrôlé par le moteur.",
    takeaway: "Un indirect redondant peut être masqué si un direct proche part à ±1 h et arrive plus tôt ou à la même heure. « Afficher aussi les autres correspondances » les rend toutes à nouveau visibles."
  },
  {
    number: "04",
    icon: CalendarDays,
    title: "Vérifie le retour",
    body: "Coche « Je veux un retour TGV MAX », puis indique sa date et sa plage horaire. MaxTrip inverse les gares et ne garde que les allers auxquels il associe au moins un retour compatible.",
    takeaway: "Si le retour est obligatoire, un direct ne masque jamais un indirect lorsque ce direct n’a pas lui-même de retour compatible."
  }
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
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">De la sélection de la gare à la vérification du retour, voici ce que MaxTrip recherche, ce qu’il compare et ce que ses résultats veulent dire.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {steps.map(({ number, icon: Icon, title, body, takeaway }) => (
            <article key={number} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
              <span aria-hidden="true" className="absolute right-5 top-3 text-5xl font-black tracking-tighter text-slate-100">{number}</span>
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <Icon size={23} aria-hidden="true"/>
                </div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Étape {number}</p>
                <h2 className="mt-2 text-xl font-black text-ink">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-navy">À retenir</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{takeaway}</p>
                </div>
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
              <h2 id="connection-rule" className="mt-1 text-xl font-black text-emerald-950">Pourquoi certaines correspondances sont masquées&nbsp;?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-950/75">Le moteur ne supprime pas un itinéraire. Il réduit seulement le bruit lorsque plusieurs options mènent à la même destination.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/70 p-4"><p className="font-bold text-emerald-950">1. Même destination</p><p className="mt-1 text-sm leading-5 text-emerald-950/70">Le direct et l’indirect sont comparés destination par destination.</p></div>
            <div className="rounded-2xl border border-white/80 bg-white/70 p-4"><p className="font-bold text-emerald-950">2. Direct proche</p><p className="mt-1 text-sm leading-5 text-emerald-950/70">Le départ doit être dans une fenêtre de 60 minutes et l’arrivée au plus tardive.</p></div>
            <div className="rounded-2xl border border-white/80 bg-white/70 p-4"><p className="font-bold text-emerald-950">3. Retour préservé</p><p className="mt-1 text-sm leading-5 text-emerald-950/70">Avec un retour demandé, le direct doit aussi avoir un retour compatible.</p></div>
          </div>
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
              <li className="flex gap-2"><Clock3 size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true"/>Les horaires, durées et correspondances sont calculés à partir de ces segments.</li>
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
              <li>Les changements de gare ne sont proposés que lorsqu’une règle de transfert fiable existe. À Paris, le moteur réserve au minimum une heure.</li>
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
