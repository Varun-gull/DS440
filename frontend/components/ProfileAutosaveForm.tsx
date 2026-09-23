"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MultiSelectField } from "@/components/MultiSelectField";
import type { SchoolOption } from "@/lib/schools";
import type { Profile } from "@/lib/types";

type SelectOption = {
  label: string;
  value: string;
};

type ProfileAutosaveFormProps = {
  profile: Profile;
  schools: SchoolOption[];
  targetRoleOptions: SelectOption[];
  targetLocationOptions: SelectOption[];
};

function isKnownSchool(schools: SchoolOption[], schoolName: string) {
  const normalizedSchoolName = schoolName.trim().toLowerCase();
  return schools.some((school) => school.name.toLowerCase() === normalizedSchoolName);
}

export function ProfileAutosaveForm({ profile, schools, targetRoleOptions, targetLocationOptions }: ProfileAutosaveFormProps) {
  const [fullName, setFullName] = useState(profile.name);
  const [school, setSchool] = useState(profile.school === "CareerUp Student" ? "" : profile.school);
  const [customSchoolMode, setCustomSchoolMode] = useState(Boolean(profile.school) && profile.school !== "CareerUp Student" && !isKnownSchool(schools, profile.school));
  const [major, setMajor] = useState(profile.major);
  const [graduationYear, setGraduationYear] = useState(profile.graduationYear);
  const [targetRoles, setTargetRoles] = useState(profile.targetRoles);
  const [targetLocations, setTargetLocations] = useState(profile.targetLocations);
  const [shareApplicationBoard, setShareApplicationBoard] = useState(profile.shareApplicationBoard);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const hasMounted = useRef(false);

  const payload = useMemo(() => ({
    fullName,
    school,
    major,
    graduationYear,
    targetRoles,
    targetLocations,
    shareApplicationBoard,
  }), [fullName, school, major, graduationYear, targetRoles, targetLocations, shareApplicationBoard]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      setMessage("Saving...");

      try {
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not save profile.");
        }

        setSaveStatus("saved");
        setMessage("Saved");
      } catch (error) {
        if (controller.signal.aborted) return;
        setSaveStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not save profile.");
      }
    }, 700);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [payload]);

  return (
    <div className="mt-5 grid gap-5">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Autosaves changes</p>
        <p className={`text-xs font-bold ${saveStatus === "error" ? "text-red-500" : saveStatus === "saving" ? "text-slate-500" : "text-[#2A6384]"}`}>
          {message}
        </p>
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Name
        <input value={fullName} onChange={(event) => setFullName(event.currentTarget.value)} className="field" required />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          School
          {customSchoolMode ? (
            <input value={school} onChange={(event) => setSchool(event.currentTarget.value)} autoComplete="organization" className="field" placeholder="Type your school name" />
          ) : (
            <select
              value={isKnownSchool(schools, school) ? school : ""}
              className="field"
              onChange={(event) => {
                if (event.currentTarget.value === "__other__") {
                  setSchool("");
                  setCustomSchoolMode(true);
                  return;
                }
                setSchool(event.currentTarget.value);
              }}
            >
              <option value="">Choose your school</option>
              {schools.map((schoolOption) => (
                <option key={schoolOption.name} value={schoolOption.name}>
                  {schoolOption.name}
                </option>
              ))}
              <option value="__other__">Other</option>
            </select>
          )}
          <span className="text-xs font-bold text-slate-500">Listed schools get an automatic logo. Choose Other to type a custom school name.</span>
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Major
          <input value={major} onChange={(event) => setMajor(event.currentTarget.value)} className="field" placeholder="Computer Science" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Graduation year
        <input value={graduationYear} onChange={(event) => setGraduationYear(event.currentTarget.value)} className="field" placeholder="2027" inputMode="numeric" />
      </label>

      <MultiSelectField
        label="Target roles"
        name="targetRoles"
        options={targetRoleOptions}
        initialValues={targetRoles}
        placeholder="Choose target roles"
        onValuesChange={setTargetRoles}
      />

      <MultiSelectField
        label="Target locations"
        name="targetLocations"
        options={targetLocationOptions}
        initialValues={targetLocations}
        placeholder="Choose target locations"
        onValuesChange={setTargetLocations}
      />

      <label className="flex gap-3 rounded-2xl border border-sky/20 bg-[#EAF2F8] p-4 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={shareApplicationBoard}
          onChange={(event) => setShareApplicationBoard(event.currentTarget.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        <span>
          Let accepted friends view my application board.
          <span className="mt-1 block text-xs font-semibold text-slate-500">Only accepted friends can see it, and they cannot edit your applications.</span>
        </span>
      </label>
    </div>
  );
}
