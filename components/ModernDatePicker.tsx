"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}
function isoDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function formatDate(value: string): string {
  if (!value) return "Choisir une date";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(parseDate(value));
}
function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}
const DAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

export default function ModernDatePicker({ label, value, min, onChange }: {
  label: string; value: string; min?: string; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => { const date = parseDate(value || isoDate(new Date())); return new Date(date.getFullYear(), date.getMonth(), 1, 12); });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = isoDate(new Date());
  const earliest = min && min > today ? min : today;
  const previousMonthDisabled = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0, 12)) < earliest;
  const choose = (day: number) => {
    const date = isoDate(new Date(month.getFullYear(), month.getMonth(), day, 12));
    if (date < earliest) return;
    onChange(date);
    setOpen(false);
    trigger.current?.focus();
  };
  return <div ref={root} className="relative min-w-0">
    <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays size={17} aria-hidden="true"/>{label}</span>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMonth(new Date(parseDate(value).getFullYear(), parseDate(value).getMonth(), 1, 12)); setOpen(!open); }}
      className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50/30 focus-visible:outline-2 focus-visible:outline-emerald-600">
      <span className="min-w-0 truncate text-sm font-medium capitalize text-slate-900 sm:text-base">{formatDate(value)}</span>
      <CalendarDays size={20} className="shrink-0 text-emerald-700" aria-hidden="true"/>
    </button>
    {open && <div role="dialog" aria-label={"Choisir " + label.toLowerCase()} className="absolute left-0 top-full z-[120] mt-2 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" aria-label="Mois précédent" disabled={previousMonthDisabled} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))} className="rounded-xl p-2 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={20}/></button>
        <strong className="text-sm font-bold capitalize text-slate-900">{monthLabel(month)}</strong>
        <button type="button" aria-label="Mois suivant" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))} className="rounded-xl p-2 hover:bg-slate-100"><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">{DAYS.map(day => <span key={day} className="py-2 text-xs font-semibold text-slate-500">{day}</span>)}
        {Array.from({ length: firstWeekday }, (_, index) => <span key={"blank-" + index}/>)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1, date = isoDate(new Date(month.getFullYear(), month.getMonth(), day, 12));
          const selected = date === value, disabled = date < earliest;
          return <button key={date} type="button" disabled={disabled} aria-label={new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(parseDate(date))} aria-pressed={selected} onClick={() => choose(day)}
            className={"flex aspect-square min-h-9 items-center justify-center rounded-xl text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-emerald-600 " + (selected ? "bg-emerald-700 text-white shadow-sm" : disabled ? "text-slate-300" : date === today ? "border border-emerald-400 text-emerald-800 hover:bg-emerald-50" : "text-slate-800 hover:bg-emerald-50")}>{day}</button>;
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <button type="button" onClick={() => { const date = earliest; onChange(date); setOpen(false); }} className="rounded-lg px-2 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">{min ? "Première date possible" : "Aujourd’hui"}</button>
        <button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-100"><X size={14}/> Fermer</button>
      </div>
    </div>}
  </div>;
}
