"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/lib/types";

export async function addInterviewEvent({
  applicationId, company, role, date, time, notes,
}: {
  applicationId: string; company: string; role: string;
  date: string; time: string; notes: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("calendar_events").insert({
    user_id: user.id,
    application_id: applicationId,
    company,
    role,
    status: "interviewing",
    event_type: "interview",
    date,
    time: time || null,
    notes: notes || null,
  });

  // If time/notes columns don't exist yet, retry without them
  if (error) {
    await supabase.from("calendar_events").insert({
      user_id: user.id,
      application_id: applicationId,
      company,
      role,
      status: "interviewing",
      event_type: "interview",
      date,
    });
  }

  revalidatePath("/calendar");
}

export async function addCalendarEvent(formData: FormData) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("calendar_events").insert({
    user_id: user.id,
    application_id: String(formData.get("applicationId")),
    company: String(formData.get("company")),
    role: String(formData.get("role")),
    status: String(formData.get("status")),
    event_type: String(formData.get("eventType") ?? "custom"),
    date: String(formData.get("date")),
  });

  revalidatePath("/calendar");
}

export async function createCustomCalendarEvent({
  title, date, time, notes,
}: {
  title: string; date: string; time: string | null; notes: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const base = {
    user_id: user.id,
    application_id: "custom",
    company: title,
    role: "",
    status: "custom",
    event_type: "custom",
    date,
  };

  const { error } = await supabase.from("calendar_events").insert({ ...base, time, notes });
  if (error) {
    await supabase.from("calendar_events").insert(base);
  }

  revalidatePath("/calendar");
}

export async function promoteAndMoveCalendarEvent({
  applicationId, company, role, status, eventType, date,
}: {
  applicationId: string; company: string; role: string;
  status: string; eventType: string; date: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Delete any existing DB record for this app+eventType, then insert at new date
  await supabase.from("calendar_events")
    .delete()
    .eq("user_id", user.id)
    .eq("application_id", applicationId)
    .eq("event_type", eventType);

  await supabase.from("calendar_events").insert({
    user_id: user.id,
    application_id: applicationId,
    company,
    role,
    status,
    event_type: eventType,
    date,
  });

  revalidatePath("/calendar");
}

export async function moveCalendarEvent(id: string, newDate: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("calendar_events")
    .update({ date: newDate })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/calendar");
}

export async function deleteCalendarEvent(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/calendar");
}

export async function seedCalendarEventsForApplication({
  applicationId,
  company,
  role,
  status,
  deadline,
}: {
  applicationId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  deadline: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  const inserts = [
    {
      user_id: user.id,
      application_id: applicationId,
      company,
      role,
      status,
      event_type: "submitted",
      date: today,
    },
  ];

  if (deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    inserts.push({
      user_id: user.id,
      application_id: applicationId,
      company,
      role,
      status,
      event_type: "deadline",
      date: deadline,
    });
  }

  await supabase.from("calendar_events").insert(inserts);
  revalidatePath("/calendar");
}
