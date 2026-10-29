import Link from "next/link";
import { CircleHelp, Search, TrainFront } from "lucide-react";

type SiteHeaderProps = { active: "search" | "help" };

const baseLink = "inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-sm font-bold leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-none";

export default function SiteHeader({ active }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 overflow-hidden border-b border-white/10 bg-[linear-gradient(115deg,#122b4b_0%,#174d68_62%,#087f69_100%)] text-white shadow-[0_8px_30px_rgba(20,45,78,.18)]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-32 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/#recherche" className="flex min-w-0 items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint text-navy shadow-lg shadow-black/10 ring-1 ring-white/30">
            <TrainFront size={25} aria-hidden="true"/>
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-lg font-black tracking-tight sm:text-xl">
              MaxTrip
              <span className="hidden rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 sm:inline-flex">TGV MAX</span>
            </span>
            <span className="block truncate text-[11px] font-medium text-white/70 sm:text-xs">Le repérage simple des trajets disponibles</span>
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="ml-auto flex w-full items-center gap-1 rounded-2xl border border-white/15 bg-black/10 p-1 backdrop-blur sm:w-auto">
          <Link href="/#recherche" aria-current={active === "search" ? "page" : undefined}
            className={baseLink + (active === "search" ? " bg-white text-navy shadow-lg" : " text-white/80 hover:bg-white/10 hover:text-white")}>
            <Search size={16} aria-hidden="true"/> Recherche
          </Link>
          <Link href="/comment-ca-marche" aria-current={active === "help" ? "page" : undefined}
            className={baseLink + (active === "help" ? " bg-white text-navy shadow-lg" : " text-white/80 hover:bg-white/10 hover:text-white")}>
            <CircleHelp size={16} aria-hidden="true"/> Comment ça marche
          </Link>
        </nav>

      </div>
    </header>
  );
}
