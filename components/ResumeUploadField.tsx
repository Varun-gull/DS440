"use client";

import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResumeUploadField() {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "saved" | "error">("idle");
  const [message, setMessage] = useState("PDF, DOCX, TXT, MD, and CSV. Text-based PDFs work best.");

  async function uploadResume(file: File) {
    const formData = new FormData();
    formData.append("resumeFile", file);
    setStatus("uploading");
    setMessage("Uploading and reading resume...");

    try {
      const response = await fetch("/api/profile/resume", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save resume.");
      }

      setStatus("saved");
      setMessage(result.message || "Resume saved.");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save resume.");
    }
  }

  return (
    <label className="group grid cursor-pointer gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center transition hover:border-sky hover:bg-sky/5">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
        {status === "uploading" ? <Loader2 size={20} className="animate-spin" /> : status === "saved" ? <CheckCircle2 size={20} /> : <UploadCloud size={20} />}
      </span>
      <span className="text-sm font-bold text-slate-800">{fileName || "Upload resume file"}</span>
      <span className={`text-xs font-bold ${status === "error" ? "text-red-500" : status === "saved" ? "text-[#2A6384]" : "text-slate-500"}`}>{message}</span>
      <input
        name="resumeFile"
        type="file"
        accept=".txt,.md,.csv,.pdf,.docx"
        className="sr-only"
        disabled={status === "uploading"}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setFileName(file?.name ?? "");
          if (file) {
            void uploadResume(file);
          }
        }}
      />
    </label>
  );
}
