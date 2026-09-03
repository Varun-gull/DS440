"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

type Props = {
  company: string;
  role: string;
  initialDate?: string;
  initialTime?: string;
  initialNotes?: string;
  onConfirm: (date: string, time: string, notes: string) => void;
  onCancel: () => void;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00",
  "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);

  for (let d = 1; d <= last.getDate(); d += 1) {
    cells.push(new Date(year, month, d));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function formatSlot(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function InterviewModal({ company, role, initialDate, initialTime, initialNotes, onConfirm, onCancel }: Props) {
  const today = todayLocal();
  const todayDate = new Date(`${today}T12:00:00`);

  const [step, setStep] = useState<1 | 2>(1);
  const [calYear, setCalYear] = useState(todayDate.getFullYear());
  const [calMonth, setCalMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [selectedTime, setSelectedTime] = useState(initialTime ?? "");
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [customTime, setCustomTime] = useState(initialTime ?? "");

  const grid = getMonthGrid(calYear, calMonth);

  function prevMonth() {
    if (calMonth === 0) {
      setCalYear((year) => year - 1);
      setCalMonth(11);
    } else {
      setCalMonth((month) => month - 1);
    }
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalYear((year) => year + 1);
      setCalMonth(0);
    } else {
      setCalMonth((month) => month + 1);
    }
  }

  function pickDate(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedTime("");
    setCustomTimeOpen(false);
    setStep(2);
  }

  function handleConfirm() {
    onConfirm(selectedDate || today, selectedTime, initialNotes ?? "");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-ink">Schedule interview</h2>
            <p className="mt-0.5 text-sm text-slate-500">{company} — {role}</p>
          </div>
          <button onClick={onCancel} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {step === 1 && (
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between">
              <button type="button" onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <ChevronLeft size={18} />
              </button>
              <span className="text-base font-bold text-ink">{MONTHS[calMonth]} {calYear}</span>
              <button type="button" onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7">
              {DAYS.map((day) => (
                <div key={day} className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{day}</div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-y-1">
              {grid.map((date, index) => {
                if (!date) {
                  return <div key={index} />;
                }

                const key = toYMD(date);
                const isToday = key === today;
                const isPast = key < today;
                const isSelected = key === selectedDate;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isPast}
                    onClick={() => pickDate(key)}
                    className={clsx(
                      "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition",
                      isSelected && "bg-sky font-bold text-white",
                      !isSelected && isToday && "font-bold text-[#2A6384] ring-2 ring-sky",
                      !isSelected && !isToday && !isPast && "text-slate-700 hover:bg-[#EAF2F8] hover:text-slate-900",
                      isPast && "cursor-not-allowed text-slate-300"
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">Pick a date to choose a time</p>
          </div>
        )}

        {step === 2 && (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold text-ink">{selectedDate ? formatDateLabel(selectedDate) : ""}</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((time) => {
                const selected = selectedTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      setSelectedTime(time);
                      setCustomTimeOpen(false);
                    }}
                    className={clsx(
                      "rounded-xl py-2.5 text-sm font-bold transition",
                      selected
                        ? "bg-sky text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-sky/20 hover:text-slate-900"
                    )}
                  >
                    {formatSlot(time)}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomTimeOpen((open) => !open)}
                className={clsx(
                  "rounded-xl py-2.5 text-sm font-bold transition",
                  customTimeOpen
                    ? "bg-brand/20 text-slate-900 ring-1 ring-brand/40"
                    : "bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                Custom
              </button>
            </div>

            {customTimeOpen && (
              <div className="mt-3 flex gap-2">
                <input
                  type="time"
                  value={customTime}
                  onChange={(event) => {
                    setCustomTime(event.target.value);
                    setSelectedTime(event.target.value);
                  }}
                  className="field flex-1 text-sm"
                  aria-label="Custom time"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTime(customTime);
                    setCustomTimeOpen(false);
                  }}
                  className="rounded-xl bg-sky px-4 text-sm font-bold text-white transition hover:bg-brand"
                >
                  Use
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedTime}
              className="primary-button mt-5 w-full disabled:opacity-40"
            >
              Add Calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
