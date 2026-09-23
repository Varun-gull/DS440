"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ApplicationCard } from "@/components/ApplicationCard";
import { statusAccents } from "@/components/ApplicationStatusBadge";
import { InterviewModal } from "@/components/InterviewModal";
import { addInterviewEvent } from "@/lib/calendar/actions";
import { updateApplicationStatus } from "@/lib/applications/actions";
import { dispatchInterviewScheduled } from "@/lib/interviewEvents";
import type { Application, ApplicationStatus } from "@/lib/types";

type PipelineColumn = {
  status: ApplicationStatus;
  title: string;
  helper: string;
};

export function ApplicationPipelineBoard({ applications, columns }: { applications: Application[]; columns: PipelineColumn[] }) {
  const router = useRouter();
  const [boardApplications, setBoardApplications] = useState(applications);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingInterview, setPendingInterview] = useState<{ applicationId: string; app: Application } | null>(null);

  const groupedApplications = useMemo(() => {
    return columns.reduce<Record<ApplicationStatus, Application[]>>(
      (groups, column) => {
        groups[column.status] = boardApplications.filter((application) => application.status === column.status);
        return groups;
      },
      {
        saved: [],
        applied: [],
        interviewing: [],
        offer: [],
        rejected: []
      }
    );
  }, [boardApplications, columns]);

  function moveApplication(applicationId: string, nextStatus: ApplicationStatus) {
    const previousApplications = boardApplications;
    const application = previousApplications.find((item) => item.id === applicationId);

    if (!application || application.status === nextStatus) {
      return;
    }

    if (application.status === "applied" && nextStatus === "interviewing") {
      setPendingInterview({ applicationId, app: application });
      return;
    }

    setBoardApplications((currentApplications) =>
      currentApplications.map((item) => (item.id === applicationId ? { ...item, status: nextStatus } : item))
    );

    startTransition(async () => {
      const formData = new FormData();
      formData.set("applicationId", applicationId);
      formData.set("status", nextStatus);
      try {
        await updateApplicationStatus(formData);
        router.refresh();
      } catch {
        setBoardApplications(previousApplications);
      }
    });
  }

  function confirmInterview(date: string, time: string, notes: string) {
    if (!pendingInterview) return;
    const { applicationId, app } = pendingInterview;
    setPendingInterview(null);
    setBoardApplications((curr) => curr.map((item) => item.id === applicationId ? { ...item, status: "interviewing" } : item));
    dispatchInterviewScheduled({
      id: `pending-${Date.now()}`,
      applicationId,
      company: app.company,
      role: app.role,
      status: "interviewing",
      eventType: "interview",
      date,
      time,
      notes,
    });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("applicationId", applicationId);
      fd.set("status", "interviewing");
      await updateApplicationStatus(fd);
      await addInterviewEvent({ applicationId, company: app.company, role: app.role, date, time, notes });
      router.refresh();
    });
  }

  return (
    <>
    {pendingInterview && (
      <InterviewModal
        company={pendingInterview.app.company}
        role={pendingInterview.app.role}
        onConfirm={confirmInterview}
        onCancel={() => setPendingInterview(null)}
      />
    )}
    <section className="mt-6 overflow-x-auto pb-4">
      <div className="grid min-w-[1120px] gap-4 xl:grid-cols-5">
        {columns.map((column) => {
          const columnApplications = groupedApplications[column.status];
          const isActive = activeStatus === column.status;
          const isDragging = draggedId !== null;

          return (
            <div
              key={column.status}
              onDragOver={(event) => {
                event.preventDefault();
                setActiveStatus(column.status);
              }}
              onDragLeave={() => setActiveStatus(null)}
              onDrop={(event) => {
                event.preventDefault();
                const applicationId = event.dataTransfer.getData("text/plain") || draggedId;
                setActiveStatus(null);
                setDraggedId(null);

                if (applicationId) {
                  moveApplication(applicationId, column.status);
                }
              }}
              className={clsx(
                "min-w-0 rounded-3xl p-3 shadow-sm ring-inset backdrop-blur-xl transition duration-200 ease-out",
                isDragging ? "ring-2" : "ring-1",
                // The active ring must not compete with the resting stage ring:
                // emitting both leaves the winner up to stylesheet order.
                isActive
                  ? "-translate-y-1 bg-[#EAF2F8] shadow-glow ring-[#2A6384]/60"
                  : clsx("bg-white/80", statusAccents[column.status].column),
                isPending && "opacity-90"
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={clsx("h-2 w-2 shrink-0 rounded-full", statusAccents[column.status].dot)} aria-hidden />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{column.title}</h2>
                    <p className="truncate text-xs text-slate-500">{column.helper}</p>
                  </div>
                </div>
                <span className="metric rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                  {columnApplications.length}
                </span>
              </div>

              {columnApplications.length > 0 ? (
                <div className="grid min-w-0 gap-3">
                  {columnApplications.map((application) => (
                    <div
                      key={application.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", application.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedId(application.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setActiveStatus(null);
                      }}
                      className={clsx(
                        "min-w-0 cursor-grab transition duration-150 ease-out active:cursor-grabbing",
                        draggedId === application.id && "scale-[0.97] opacity-40"
                      )}
                    >
                      <ApplicationCard application={application} compact />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={clsx(
                    "rounded-2xl border border-dashed p-4 text-sm transition duration-200 ease-out",
                    isActive
                      ? "border-[#2A6384]/60 bg-white text-[#2A6384]"
                      : "border-slate-200 bg-slate-50/80 text-slate-500"
                  )}
                >
                  {isDragging ? `Release to mark ${column.title.toLowerCase()}.` : "Drop roles here."}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
    </>
  );
}
