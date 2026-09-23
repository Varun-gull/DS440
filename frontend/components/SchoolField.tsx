"use client";

import { useState } from "react";
import type { SchoolOption } from "@/lib/schools";

function isKnownSchool(schools: SchoolOption[], schoolName: string) {
  const normalizedSchoolName = schoolName.trim().toLowerCase();
  return schools.some((school) => school.name.toLowerCase() === normalizedSchoolName);
}

export function SchoolField({ schools, initialSchool }: { schools: SchoolOption[]; initialSchool: string }) {
  const [customMode, setCustomMode] = useState(Boolean(initialSchool) && !isKnownSchool(schools, initialSchool));

  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      School
      {customMode ? (
        <input
          name="school"
          defaultValue={isKnownSchool(schools, initialSchool) ? "" : initialSchool}
          autoComplete="organization"
          autoFocus
          className="field"
          placeholder="Type your school name"
        />
      ) : (
        <select
          name="school"
          defaultValue={isKnownSchool(schools, initialSchool) ? initialSchool : ""}
          className="field"
          onChange={(event) => {
            if (event.currentTarget.value === "__other__") {
              setCustomMode(true);
            }
          }}
        >
          <option value="">Choose your school</option>
          {schools.map((school) => (
            <option key={school.name} value={school.name}>
              {school.name}
            </option>
          ))}
          <option value="__other__">Other</option>
        </select>
      )}
      <span className="text-xs font-bold text-slate-500">Listed schools get an automatic logo. Choose Other to type a custom school name.</span>
    </label>
  );
}
