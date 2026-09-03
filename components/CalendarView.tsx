"use client";

import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import clsx from "clsx";
import { ApplicationStatusBadge } from "@/components/ApplicationStatusBadge";
import { CalendarCreateModal } from "@/components/CalendarCreateModal";
import { InterviewModal } from "@/components/InterviewModal";
import { addCalendarEvent, addInterviewEvent, deleteCalendarEvent, moveCalendarEvent, promoteAndMoveCalendarEvent } from "@/lib/calendar/actions";
import { INTERVIEW_SCHEDULED_EVENT, clearStoredInterview, dispatchInterviewScheduled, getStoredInterviewDate } from "@/lib/interviewEvents";
import { deadlinePrefix, deadlineStyle, deadlineUrgency } from "@/lib/signal";
import type { DeadlineUrgency } from "@/lib/signal";
import type { Application, CalendarEvent } from "@/lib/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* A month grid is only useful if the chips are told apart at a glance, so event
   types follow the same pipeline progression used on the board: pale blue when
   applied, brand blue for an interview, emerald for an offer, slate for a note.
   Deadlines are the one type with a direction, so they take the urgency ramp. */
const EVENT_STYLE: Record<CalendarEvent["eventType"], string> = {
  deadline: "border-slate-300 bg-slate-100 text-slate-700",
  submitted: "border-[#8FB8D4]/60 bg-[#EDF5FA] text-[#173B55]",
  interview: "border-[#2A6384]/50 bg-[#EAF2F8] text-[#214E69]",
  offer: "border-emerald-300 bg-emerald-50 text-emerald-800",
  custom: "border-slate-300 bg-white text-slate-700",
};

const EVENT_DOT: Record<CalendarEvent["eventType"], string> = {
  deadline: "bg-slate-400",
  submitted: "bg-[#8FB8D4]",
  interview: "bg-[#2A6384]",
  offer: "bg-emerald-600",
  custom: "bg-slate-500",
};

const DEADLINE_CHIP: Record<DeadlineUrgency, string> = {
  overdue: "border-rose-300 bg-rose-50 text-rose-800",
  today: "border-rose-300 bg-rose-50 text-rose-800",
  soon: "border-amber-300 bg-amber-50 text-amber-900",
  later: "border-slate-300 bg-slate-100 text-slate-700",
  none: "border-slate-300 bg-slate-100 text-slate-700",
};

const DEADLINE_DOT: Record<DeadlineUrgency, string> = {
  overdue: "bg-rose-600",
  today: "bg-rose-600",
  soon: "bg-amber-600",
  later: "bg-slate-500",
  none: "bg-slate-500",
};

function eventChipStyle(event: CalendarEvent) {
  if (event.eventType !== "deadline") {
    return EVENT_STYLE[event.eventType];
  }

  return DEADLINE_CHIP[deadlineUrgency(event.date)];
}

function eventDotStyle(event: CalendarEvent) {
  if (event.eventType !== "deadline") {
    return EVENT_DOT[event.eventType];
  }

  return DEADLINE_DOT[deadlineUrgency(event.date)];
}

const EVENT_LABEL: Record<CalendarEvent["eventType"], string> = {
  deadline: "Deadline",
  submitted: "Applied",
  interview: "Interview",
  offer: "Offer",
  custom: "Event",
};

function toYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromYMD(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatShortDate(value: string) {
  const date = fromYMD(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLongDate(value: string) {
  const date = fromYMD(value);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = startOfWeek(first);
  const days: Date[] = [];
  const cursor = new Date(start);

  while (cursor <= last || days.length % 7 !== 0) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (days.length >= 42) break;
  }

  return days;
}

function getDaysUntil(date: string, today: string) {
  const target = fromYMD(date).getTime();
  const current = fromYMD(today).getTime();
  return Math.ceil((target - current) / 86_400_000);
}

function buildEvents(applications: Application[], dbEvents: CalendarEvent[]) {
  const derivedDeadlines: CalendarEvent[] = applications
    .filter((application) => application.deadline && /^\d{4}-\d{2}-\d{2}$/.test(application.deadline))
    .map((application) => ({
      id: `derived-deadline-${application.id}`,
      applicationId: application.id,
      company: application.company,
      role: application.role,
      status: application.status,
      eventType: "deadline" as const,
      date: application.deadline,
    }));

  const existingKeys = new Set(dbEvents.map((event) => `${event.applicationId}-${event.eventType}-${event.date}`));
  const localInterviews = applications.flatMap((application): CalendarEvent[] => {
      const date = getStoredInterviewDate(application.id);
      if (!date) return [];

      return [{
        id: `pending-interview-${application.id}`,
        applicationId: application.id,
        company: application.company,
        role: application.role,
        status: application.status,
        eventType: "interview" as const,
        date,
      }];
    });

  return [
    ...dbEvents,
    ...derivedDeadlines.filter((event) => !existingKeys.has(`${event.applicationId}-${event.eventType}-${event.date}`)),
    ...localInterviews.filter((event) => !dbEvents.some((dbEvent) => dbEvent.applicationId === event.applicationId && dbEvent.eventType === "interview")),
  ];
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
  });
}

function EventPill({
  event,
  compact = false,
  draggable,
  onDragStart,
  onDelete,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (dragEvent: DragEvent<HTMLDivElement>) => void;
  onDelete?: () => void;
  onClick?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(dragEvent) => {
        dragEvent.dataTransfer.effectAllowed = "move";
        dragEvent.dataTransfer.setData("application/x-careerup-calendar-event", event.id);
        dragEvent.dataTransfer.setData("text/plain", event.id);
        onDragStart?.(dragEvent);
      }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick?.();
      }}
      className={clsx(
        "group flex w-full cursor-grab items-start gap-2 rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-sm active:cursor-grabbing",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        eventChipStyle(event)
      )}
    >
      <span className={clsx("mt-1 h-2 w-2 shrink-0 rounded-full", eventDotStyle(event))} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold">{event.company}</span>
        {!compact && <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-75">{event.role}</span>}
        <span className={clsx("block truncate text-[11px] font-bold opacity-70", compact ? "mt-0" : "mt-1")}>
          {compact ? EVENT_LABEL[event.eventType] : `${EVENT_LABEL[event.eventType]}${event.time ? ` · ${event.time}` : ""}`}
        </span>
      </span>
      {onDelete && !event.id.startsWith("derived-") && (
        <span
          role="button"
          tabIndex={0}
          onClick={(deleteEvent) => {
            deleteEvent.stopPropagation();
            onDelete();
          }}
          className="rounded-lg p-1 opacity-0 transition hover:bg-white/70 group-hover:opacity-100"
          aria-label="Delete calendar event"
        >
          <Trash2 size={12} />
        </span>
      )}
    </div>
  );
}

export function CalendarView({ applications, dbEvents }: { applications: Application[]; dbEvents: CalendarEvent[] }) {
  const today = new Date();
  const todayStr = toYMD(today);
  const [anchor, setAnchor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [dragApp, setDragApp] = useState<Application | null>(null);
  const [dragEvent, setDragEvent] = useState<CalendarEvent | null>(null);
  const [scheduleApp, setScheduleApp] = useState<Application | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(() => buildEvents(applications, dbEvents));
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    setEvents((previousEvents) => {
      const rebuilt = buildEvents(applications, dbEvents);
      const dbInterviewApplicationIds = new Set(dbEvents.filter((event) => event.eventType === "interview").map((event) => event.applicationId));
      dbInterviewApplicationIds.forEach((applicationId) => clearStoredInterview(applicationId));
      const pending = previousEvents.filter((event) => event.id.startsWith("pending-") && !dbInterviewApplicationIds.has(event.applicationId));
      return [...rebuilt.filter((event) => !pending.some((pendingEvent) => pendingEvent.applicationId === event.applicationId && pendingEvent.eventType === event.eventType)), ...pending];
    });
  }, [applications, dbEvents]);

  useEffect(() => {
    function handleInterviewScheduled(event: Event) {
      const calendarEvent = (event as CustomEvent<CalendarEvent>).detail;
      setEvents((previousEvents) => [
        ...previousEvents.filter((previousEvent) => !(previousEvent.applicationId === calendarEvent.applicationId && previousEvent.eventType === "interview")),
        calendarEvent,
      ]);
    }

    window.addEventListener(INTERVIEW_SCHEDULED_EVENT, handleInterviewScheduled);
    return () => window.removeEventListener(INTERVIEW_SCHEDULED_EVENT, handleInterviewScheduled);
  }, []);

  const monthDays = useMemo(() => getMonthGrid(anchor.getFullYear(), anchor.getMonth()), [anchor]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    sortEvents(events).forEach((event) => {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    });
    return grouped;
  }, [events]);
  const nextInterview = sortEvents(events).find((event) => event.eventType === "interview" && event.date >= todayStr);
  const upcomingDeadlineCount = events.filter((event) => event.eventType === "deadline" && getDaysUntil(event.date, todayStr) >= 0 && getDaysUntil(event.date, todayStr) <= 14).length;
  const unscheduledInterviews = applications.filter((application) => {
    const shouldSchedule = application.status === "interviewing" || application.status === "offer";
    const hasInterview = events.some((event) => event.applicationId === application.id && event.eventType === "interview");
    return shouldSchedule && !hasInterview;
  });

  function navigate(direction: -1 | 1) {
    setAnchor((previousAnchor) => new Date(previousAnchor.getFullYear(), previousAnchor.getMonth() + direction, 1));
  }

  function jumpToToday() {
    setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayStr);
  }

  function handleScheduleInterview(date: string, time: string, notes: string) {
    if (!scheduleApp) return;

    const application = scheduleApp;
    const newEvent: CalendarEvent = {
      id: `pending-${Date.now()}`,
      applicationId: application.id,
      company: application.company,
      role: application.role,
      status: "interviewing",
      eventType: "interview",
      date,
      time,
      notes,
    };

    setScheduleApp(null);
    setSelectedDate(date);
    setAnchor(new Date(fromYMD(date).getFullYear(), fromYMD(date).getMonth(), 1));
    setEvents((previousEvents) => [
      ...previousEvents.filter((event) => !(event.applicationId === application.id && event.eventType === "interview")),
      newEvent,
    ]);

    startTransition(async () => {
      await addInterviewEvent({ applicationId: application.id, company: application.company, role: application.role, date, time, notes });
    });
  }

  function addApplicationEvent(application: Application, date: string) {
    const newEvent: CalendarEvent = {
      id: `temp-${Date.now()}`,
      applicationId: application.id,
      company: application.company,
      role: application.role,
      status: application.status,
      eventType: application.status === "interviewing" || application.status === "offer" ? "interview" : "custom",
      date,
    };

    setEvents((previousEvents) => [...previousEvents, newEvent]);
    setSelectedDate(date);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("applicationId", application.id);
      formData.set("company", application.company);
      formData.set("role", application.role);
      formData.set("status", application.status);
      formData.set("eventType", newEvent.eventType);
      formData.set("date", date);
      await addCalendarEvent(formData);
    });
  }

  function moveEvent(event: CalendarEvent, date: string) {
    if (event.date === date) return;

    const movedEvent = { ...event, date };
    setEvents((previousEvents) => previousEvents.map((previousEvent) => previousEvent.id === event.id ? movedEvent : previousEvent));
    setSelectedDate(date);

    if (event.eventType === "interview") {
      dispatchInterviewScheduled(movedEvent);
    }

    startTransition(async () => {
      if (event.id.startsWith("derived-") || event.id.startsWith("temp-") || event.id.startsWith("pending-")) {
        await promoteAndMoveCalendarEvent({
          applicationId: event.applicationId,
          company: event.company,
          role: event.role,
          status: event.status,
          eventType: event.eventType,
          date,
        });
      } else {
        await moveCalendarEvent(event.id, date);
      }
    });
  }

  function handleDrop(date: string, dropEvent: DragEvent<HTMLDivElement>) {
    const droppedApplicationId = dropEvent.dataTransfer.getData("application/x-careerup-application");
    const droppedEventId = dropEvent.dataTransfer.getData("application/x-careerup-calendar-event");
    const droppedApplication = dragApp ?? applications.find((application) => application.id === droppedApplicationId) ?? null;
    const droppedEvent = dragEvent ?? events.find((event) => event.id === droppedEventId) ?? null;

    setActiveDate(null);

    if (droppedApplication) {
      addApplicationEvent(droppedApplication, date);
      setDragApp(null);
      return;
    }

    if (droppedEvent) {
      moveEvent(droppedEvent, date);
      setDragEvent(null);
    }
  }

  function handleDelete(id: string) {
    setEvents((previousEvents) => previousEvents.filter((event) => event.id !== id));
    startTransition(async () => {
      await deleteCalendarEvent(id);
    });
  }

  return (
    <section className="space-y-5">
      {createDate && (
        <CalendarCreateModal
          defaultDate={createDate}
          onClose={() => setCreateDate(null)}
          onCreated={() => {
            setCreateDate(null);
            router.refresh();
          }}
        />
      )}

      {scheduleApp && (() => {
        const existingEvent = events.find((event) => event.applicationId === scheduleApp.id && event.eventType === "interview");
        return (
          <InterviewModal
            company={scheduleApp.company}
            role={scheduleApp.role}
            initialDate={existingEvent?.date}
            initialTime={existingEvent?.time}
            initialNotes={existingEvent?.notes}
            onConfirm={handleScheduleInterview}
            onCancel={() => setScheduleApp(null)}
          />
        );
      })()}

      <div className="grid gap-4 md:grid-cols-4">
        <section className="card p-5">
          <CalendarClock className="text-[#2A6384]" size={22} />
          <p className="mt-4 text-sm font-semibold text-slate-600">Next interview</p>
          <p className="mt-1 text-xl font-bold text-ink">{nextInterview ? formatShortDate(nextInterview.date) : "None set"}</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{nextInterview ? nextInterview.company : "Schedule one from your board."}</p>
        </section>
        <section className="card p-5">
          <ListChecks className="text-[#2A6384]" size={22} />
          <p className="mt-4 text-sm font-semibold text-slate-600">Next 14 days</p>
          <p className="mt-1 text-xl font-bold text-ink">{upcomingDeadlineCount} deadlines</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Roles needing attention soon.</p>
        </section>
        <section className="card p-5">
          <Video className="text-[#2A6384]" size={22} />
          <p className="mt-4 text-sm font-semibold text-slate-600">Needs time</p>
          <p className="mt-1 text-xl font-bold text-ink">{unscheduledInterviews.length} interviews</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Interviewing roles without a date.</p>
        </section>
        <section className="card p-5">
          <BriefcaseBusiness className="text-[#2A6384]" size={22} />
          <p className="mt-4 text-sm font-semibold text-slate-600">Tracked roles</p>
          <p className="mt-1 text-xl font-bold text-ink">{applications.length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Drag roles onto dates.</p>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="card overflow-hidden p-5 xl:sticky xl:top-24 xl:self-start">
          <p className="eyebrow">Schedule interviews</p>
          <h2 className="mt-1 text-xl font-bold text-ink">Drag roles onto the calendar</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Drop a role on any date, or pick an interview time directly.</p>
          <div className="mt-4 grid max-h-[42rem] gap-3 overflow-y-auto overflow-x-hidden pr-1">
            {[...unscheduledInterviews, ...applications.filter((application) => application.status !== "interviewing" && application.status !== "offer").slice(0, 8)].map((application) => (
              <div
                key={application.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("application/x-careerup-application", application.id);
                  event.dataTransfer.setData("text/plain", application.id);
                  setDragApp(application);
                }}
                onDragEnd={() => setDragApp(null)}
                className={clsx(
                  "w-full max-w-full cursor-grab overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing",
                  dragApp?.id === application.id && "opacity-45"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#2A6384]">{application.company}</p>
                    <p className="truncate text-sm font-bold text-ink">{application.role}</p>
                  </div>
                  <span className="shrink-0">
                    <ApplicationStatusBadge status={application.status} />
                  </span>
                </div>
                {application.status === "interviewing" || application.status === "offer" ? (
                  <button
                    type="button"
                    onClick={() => setScheduleApp(application)}
                    className="mt-3 rounded-xl bg-[#EAF2F8] px-3 py-2 text-xs font-bold text-[#2A6384]"
                  >
                    Pick interview time
                  </button>
                ) : application.deadline && application.deadline !== "No deadline" ? (
                  <p className={clsx("metric mt-2 text-xs font-semibold", deadlineStyle(deadlineUrgency(application.deadline)))}>
                    {deadlinePrefix(deadlineUrgency(application.deadline))} {application.deadline}
                  </p>
                ) : null}
              </div>
            ))}
            {applications.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm font-semibold text-slate-500">
                Save a role from postings to start building your calendar.
              </p>
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 shadow-soft backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-[#2A6384]/40 hover:text-[#2A6384]"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-48 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{anchor.getFullYear()}</p>
                <h2 className="text-2xl font-bold text-ink">{MONTH_NAMES[anchor.getMonth()]}</h2>
              </div>
              <button
                onClick={() => navigate(1)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-[#2A6384]/40 hover:text-[#2A6384]"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={jumpToToday} className="secondary-button min-h-10 px-4 text-sm">Today</button>
              <button onClick={() => setCreateDate(selectedDate)} className="primary-button min-h-10 px-4 text-sm">
                <Plus className="mr-2" size={16} /> Add event
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
            {DAY_NAMES.map((dayName) => (
              <div key={dayName} className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const date = toYMD(day);
              const dayEvents = eventsByDate.get(date) ?? [];
              const visibleEvents = dayEvents.slice(0, 2);
              const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);
              const isToday = date === todayStr;
              const isSelected = date === selectedDate;
              const isCurrentMonth = day.getMonth() === anchor.getMonth();

              return (
                <div
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setActiveDate(date);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setActiveDate(null);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDrop(date, event);
                  }}
                  className={clsx(
                    "min-h-32 border-b border-r border-slate-200 p-2 text-left transition",
                    "hover:bg-[#F8FBFA]",
                    isSelected && "bg-[#EAF2F8]",
                    activeDate === date && "bg-[#DDEAF2] ring-2 ring-inset ring-[#2A6384]",
                    !isCurrentMonth && "bg-slate-50/70 text-slate-400"
                  )}
                >
                  <span
                    className={clsx(
                      "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold",
                      isToday ? "bg-[#173B55] text-white" : isSelected ? "bg-white text-[#173B55]" : "text-slate-600"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-2 grid gap-1.5">
                    {visibleEvents.map((event) => (
                      <EventPill
                        key={event.id}
                        event={event}
                        compact
                        draggable
                        onDragStart={() => setDragEvent(event)}
                        onDelete={() => handleDelete(event.id)}
                        onClick={() => {
                          if (event.eventType === "interview") {
                            const application = applications.find((item) => item.id === event.applicationId);
                            if (application) setScheduleApp(application);
                          }
                        }}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <span className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                        +{hiddenCount} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
