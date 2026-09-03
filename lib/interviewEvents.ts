import type { CalendarEvent } from "@/lib/types";

export const INTERVIEW_SCHEDULED_EVENT = "interview-scheduled";

export function dispatchInterviewScheduled(event: CalendarEvent) {
  // Persist the date so the calendar page can read it after navigation
  localStorage.setItem(`interview-date-${event.applicationId}`, event.date);
  if (event.time) localStorage.setItem(`interview-time-${event.applicationId}`, event.time);
  if (event.notes) localStorage.setItem(`interview-notes-${event.applicationId}`, event.notes);
  window.dispatchEvent(new CustomEvent(INTERVIEW_SCHEDULED_EVENT, { detail: event }));
}

export function getStoredInterviewDate(applicationId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`interview-date-${applicationId}`);
}

export function clearStoredInterview(applicationId: string) {
  localStorage.removeItem(`interview-date-${applicationId}`);
  localStorage.removeItem(`interview-time-${applicationId}`);
  localStorage.removeItem(`interview-notes-${applicationId}`);
}
