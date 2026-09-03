"use client";

import { X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { createApplicationFromCalendar } from "@/lib/applications/actions";
import { createCustomCalendarEvent } from "@/lib/calendar/actions";
import type { ApplicationStatus } from "@/lib/types";

type Tab = "application" | "custom";

type Props = {
  defaultDate: string;
  onClose: () => void;
  onCreated: () => void;
};

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

export function CalendarCreateModal({ defaultDate, onClose, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>("application");
  const [status, setStatus] = useState<ApplicationStatus>("saved");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const companyRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    setError(null);

    if (tab === "application") {
      const company = companyRef.current?.value.trim() ?? "";
      const role = roleRef.current?.value.trim() ?? "";
      if (!company || !role) {
        setError("Company and role are required.");
        return;
      }
      startTransition(async () => {
        const result = await createApplicationFromCalendar({
          company,
          role,
          status,
          deadline: deadlineRef.current?.value || null,
        });
        if (result?.error) {
          setError(result.error);
          return;
        }
        onCreated();
        onClose();
      });
    } else {
      const title = titleRef.current?.value.trim() ?? "";
      const date = dateRef.current?.value || defaultDate;
      if (!title) {
        setError("Title is required.");
        return;
      }
      startTransition(async () => {
        await createCustomCalendarEvent({
          title,
          date,
          time: timeRef.current?.value || null,
          notes: notesRef.current?.value || null,
        });
        onCreated();
        onClose();
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Add to Calendar</h2>
            <p className="mt-1 text-sm text-slate-500">{defaultDate}</p>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setTab("application")}
            className={clsx(
              "flex-1 rounded-xl py-1.5 text-sm font-bold transition-colors",
              tab === "application" ? "bg-sky text-white" : "text-slate-500 hover:text-slate-700"
            )}
          >
            New Application
          </button>
          <button
            onClick={() => setTab("custom")}
            className={clsx(
              "flex-1 rounded-xl py-1.5 text-sm font-bold transition-colors",
              tab === "custom" ? "bg-sky text-white" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Custom Event
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {tab === "application" ? (
            <>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Company
                <input
                  ref={companyRef}
                  type="text"
                  placeholder="Google, Meta, Stripe…"
                  className="field"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Role
                <input
                  ref={roleRef}
                  type="text"
                  placeholder="Software Engineer Intern"
                  className="field"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                  className="field"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Deadline <span className="font-normal text-slate-600">(optional)</span>
                <input
                  ref={deadlineRef}
                  type="date"
                  defaultValue={defaultDate}
                  className="field"
                />
              </label>
            </>
          ) : (
            <>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Title
                <input
                  ref={titleRef}
                  type="text"
                  placeholder="Career fair, networking event…"
                  className="field"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Date
                <input
                  ref={dateRef}
                  type="date"
                  defaultValue={defaultDate}
                  className="field"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Time <span className="font-normal text-slate-600">(optional)</span>
                <input
                  ref={timeRef}
                  type="time"
                  className="field"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Notes <span className="font-normal text-slate-600">(optional)</span>
                <textarea
                  ref={notesRef}
                  rows={3}
                  placeholder="Details, links, reminders…"
                  className="field resize-none text-sm"
                />
              </label>
            </>
          )}
        </div>

        {error && <p className="mt-3 text-sm font-bold text-red-500">{error}</p>}

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="primary-button w-full disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Add to Calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
