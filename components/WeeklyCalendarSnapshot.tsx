import { CalendarDays, Clock3 } from "lucide-react";
import Link from "next/link";
import { getTodayKey } from "@/lib/streak";
import type { CalendarEvent } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonthGrid(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function eventLabel(type: CalendarEvent["eventType"]) {
  if (type === "submitted") return "Applied";
  if (type === "interview") return "Interview";
  if (type === "offer") return "Offer";
  if (type === "deadline") return "Deadline";
  return "Event";
}

function eventTone(type: CalendarEvent["eventType"]) {
  if (type === "interview") return "border-[#2A6384]/40 bg-sky/12 text-[#2A6384]";
  if (type === "offer") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-700";
  if (type === "deadline") return "border-[#5E7681]/35 bg-[#EAF2F8]/80 text-[#2A6384]";
  return "border-slate-600 bg-slate-100 text-slate-700";
}

export function WeeklyCalendarSnapshot({ events }: { events: CalendarEvent[] }) {
  const todayKey = getTodayKey();
  const today = new Date(`${todayKey}T12:00:00`);
  const monthStart = startOfMonthGrid(today);
  const currentMonth = today.getMonth();
  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(monthStart.getDate() + i);
    const ymd = toYMD(date);
    const dayEvents = events.filter((event) => event.date === ymd);
    return {
      date,
      ymd,
      inMonth: date.getMonth() === currentMonth,
      eventCount: dayEvents.length,
      events: dayEvents.slice(0, 2),
    };
  });

  const upcoming = events
    .filter((event) => event.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">This month</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">{MONTH_LABELS[today.getMonth()]} {today.getFullYear()}</h2>
        </div>
        <Link href="/calendar" className="secondary-button min-h-10 px-4 text-sm">
          Open calendar
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase text-slate-500">
        {DAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const isToday = day.ymd === todayKey;
          const title = day.events.length > 0
            ? day.events.map((event) => `${eventLabel(event.eventType)}: ${event.role} at ${event.company}`).join("\n")
            : "No events";
          return (
            <div
              key={day.ymd}
              title={title}
              className={`group relative min-h-24 rounded-2xl border p-2 text-left transition ${
                isToday
                  ? "border-sky/50 bg-[#EAF2F8] shadow-sm"
                  : day.inMonth
                    ? "border-[#5E7681]/30 bg-[#EAF2F8]/60 hover:border-[#2A6384]/40 hover:bg-white/80"
                    : "border-slate-200/70 bg-white/35 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={isToday ? "text-sm font-semibold text-[#2A6384]" : day.inMonth ? "text-sm font-bold text-[#2A6384]" : "text-sm font-bold text-slate-400"}>
                  {day.date.getDate()}
                </p>
                {day.eventCount > 2 && <span className="text-[10px] font-bold text-slate-500">+{day.eventCount - 2}</span>}
              </div>
              <div className="mt-3 space-y-2">
                {day.events.length > 0 ? (
                  day.events.map((event) => (
                    <div key={event.id} className={`rounded-xl border px-2 py-1.5 text-[11px] font-bold ${eventTone(event.eventType)}`} title={`${event.role} at ${event.company}`}>
                      <p className="truncate">{eventLabel(event.eventType)}</p>
                      <p className="truncate font-bold opacity-80">{event.company}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 px-2 py-2 text-xs font-bold text-slate-400">Open</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[#5E7681]/30 bg-[#EAF2F8]/60 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <CalendarDays size={17} className="text-[#2A6384]" />
          Upcoming
        </div>
        <div className="mt-3 grid gap-2">
          {upcoming.length > 0 ? (
            upcoming.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{event.role}</p>
                  <p className="truncate text-xs font-bold text-slate-600">{event.company}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EAF2F8] px-2.5 py-1 text-xs font-bold text-[#2A6384]">
                  <Clock3 size={13} /> {event.date.slice(5)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm font-bold text-slate-500">No upcoming events yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
