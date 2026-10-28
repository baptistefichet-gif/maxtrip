import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Database, GitBranch, MapPinned, Search, ShieldAlert, TrainFront } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

const steps = [
  { number: "01", icon: Search, title: "Choisis ton trajet", body: "Indique ta gare de départ et la date à laquelle tu veux voyager. Avec Explorer, découvre les destinations possibles. Avec Trajet classique, choisis directement où tu veux aller." },
  { number: "02", icon: CalendarDays, title: "Ajoute tes préférences", body: "Choisis tes heures de départ. Tu peux aussi chercher des trajets avec correspondance et demander un retour TGV MAX." },
  { number: "03", icon: MapPinned, title: "Regarde les résultats", body: "Compare les horaires et la durée des trajets. Un trajet direct se fait sans changer de train. Un trajet avec correspondance nécessite de changer de train en cours de route. Ouvre un trajet pour voir ses détails et, si tu as demandé un retour, les retours compatibles." },
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

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5"><h2 className="text-lg font-black text-emerald-950">Une envie de voyager ?</h2><p className="mt-2 text-sm leading-6 text-emerald-950">Cherche un départ le vendredi et un retour le dimanche : MaxTrip te propose les destinations pour lesquelles il trouve un aller et un retour TGV MAX compatibles. Sur les trains éligibles, tu peux voyager sans supplément avec ton abonnement, sous réserve de disponibilité.</p></div>

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
              <p className="mt-3 text-sm leading-6 text-emerald-950">Quand un trajet direct vers la même gare part à peu près à la même heure et arrive plus tôt, MaxTrip le met en avant pour simplifier les résultats. Tu peux toujours retrouver les autres possibilités avec le bouton « Afficher aussi les autres trajets avec correspondance ».</p>
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
                <h2 id="limits-heading" className="text-xl font-black text-amber-950">Quand les résultats peuvent manquer</h2>
                <p className="mt-2 text-sm leading-6 text-amber-950/75">Il arrive que MaxTrip ne puisse pas récupérer tous les trajets.</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-amber-950/80">Si certaines informations SNCF n’ont pas pu être récupérées, MaxTrip te prévient. Il peut alors exister d’autres trajets que ceux affichés.</p>
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
