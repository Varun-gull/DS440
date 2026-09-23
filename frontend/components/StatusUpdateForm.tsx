"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { InterviewModal } from "@/components/InterviewModal";
import { SelectDropdown } from "@/components/SelectDropdown";
import { addInterviewEvent } from "@/lib/calendar/actions";
import { updateApplicationStatus } from "@/lib/applications/actions";
import { dispatchInterviewScheduled } from "@/lib/interviewEvents";
import type { Application } from "@/lib/types";

const statusOptions = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
] as const;

export function StatusUpdateForm({ application, compact }: { application: Application; compact?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState(application.status);
  const [showModal, setShowModal] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected === "interviewing" && application.status !== "interviewing") {
      setShowModal(true);
    } else {
      submitStatus(selected);
    }
  }

  function submitStatus(status: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("applicationId", application.id);
      fd.set("status", status);
      await updateApplicationStatus(fd);
    });
  }

  function handleModalConfirm(date: string, time: string, notes: string) {
    setShowModal(false);
    submitStatus("interviewing");
    dispatchInterviewScheduled({
      id: `pending-${Date.now()}`,
      applicationId: application.id,
      company: application.company,
      role: application.role,
      status: "interviewing",
      eventType: "interview",
      date,
      time,
      notes,
    });
    startTransition(async () => {
      await addInterviewEvent({ applicationId: application.id, company: application.company, role: application.role, date, time, notes });
      router.refresh();
    });
  }

  return (
    <>
      {showModal && (
        <InterviewModal
          company={application.company}
          role={application.role}
          onConfirm={handleModalConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}
      <form onSubmit={handleSubmit} className={compact ? "grid gap-2" : "flex flex-wrap items-center gap-2"}>
        <input type="hidden" name="applicationId" value={application.id} />
        <SelectDropdown
          label=""
          name="status"
          value={selected}
          onChange={(v) => setSelected(v as Application["status"])}
          options={statusOptions.map((s) => ({ value: s.value, label: s.label }))}
        />
        <button type="submit" className="min-h-10 rounded-xl bg-sky px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand focus:outline-none focus:ring-4 focus:ring-[#2A6384]/20">
          Update
        </button>
      </form>
    </>
  );
}
