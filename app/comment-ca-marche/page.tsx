import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, GitBranch, MapPinned, Search, ShieldAlert, TrainFront } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "1. Choisis ton départ et ta date",
    body: "Saisis une gare ou une ville, choisis la date et l’heure de début. La borne de fin est facultative : si tu la laisses vide, MaxTrip cherche jusqu’à la fin de la journée."
  },
  {
    icon: MapPinned,
    title: "2. Explore les destinations possibles",
    body: "MaxTrip regroupe les itinéraires distincts construits depuis les données chargées. Sélectionne une destination sur la carte ou dans la liste pour ouvrir ses trajets sans perdre ta recherche."
  },
  {
    icon: GitBranch,
    title: "3. Compare les directs et les correspondances",
    body: "Un trajet direct n’a pas de changement. Un trajet indirect comprend une ou plusieurs correspondances, avec un temps d’attente vérifié par le moteur. Les alternatives jugées redondantes peuvent être masquées par défaut ; tu peux choisir de toutes les afficher."
  },
  {
    icon: CalendarDays,
    title: "4. Cherche un retour compatible",
    body: "Coche « Je veux un retour TGV MAX », indique la date et la plage horaire. MaxTrip ne conserve alors que les allers auxquels le moteur a associé au moins un itinéraire retour compatible avec les critères choisis."
  }
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-paper pb-12">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/#recherche" className="flex items-center gap-3 rounded-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-navy"><TrainFront size={25}/></span>
            <span><span className="block text-xl font-black">MaxTrip</span><span className="block text-xs text-slate-300">Les voyages MAX à portée de main</span></span>
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-2 sm:gap-4">
            <Link href="/#recherche" className="rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">Recherche</Link>
            <span className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">Comment ça marche</span>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Link href="/#recherche" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-emerald-800 hover:underline">
          <ArrowLeft size={16}/> Retour à la recherche
        </Link>
        <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-5xl">Comment ça marche ?</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">MaxTrip t’aide à explorer les trajets TGV MAX signalés disponibles, à comparer les itinéraires et à trouver un retour compatible.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {steps.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <Icon size={24} className="text-emerald-700"/>
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert size={22} className="mt-0.5 shrink-0 text-amber-800"/>
            <div>
              <h2 className="text-lg font-bold text-amber-950">À savoir avant de partir</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-950">
                <li>Les données proviennent de l’Open Data SNCF. Le jeu TGVmax est actualisé quotidiennement et décrit des disponibilités signalées sur une période glissante.</li>
                <li>Une disponibilité indiquée par MaxTrip n’est pas une confirmation de réservation. Vérifie toujours le train sur le site de vente avant de voyager.</li>
                <li>Si la recherche atteint une limite de chargement, MaxTrip le signale : des itinéraires peuvent manquer. La pagination parcourt les résultats chargés, elle ne remplace pas le chargement des données.</li>
                <li>Les correspondances avec changement de gare ne sont proposées que si le moteur dispose d’une règle de transfert suffisamment fiable ; à Paris, il réserve au minimum une heure pour un changement de gare.</li>
              </ul>
            </div>
          </div>
        </section>

        <p className="mt-6 text-xs leading-5 text-slate-500">MaxTrip est un projet indépendant et n’est pas affilié à la SNCF.</p>
        <Link href="/#recherche" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">
          <CheckCircle2 size={18}/> Commencer une recherche
        </Link>
      </section>
    </main>
  );
}
