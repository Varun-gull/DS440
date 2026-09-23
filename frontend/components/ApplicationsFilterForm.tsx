"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { SelectDropdown } from "@/components/SelectDropdown";

type Column = { status: string; title: string };

export function ApplicationsFilterForm({
  defaultQuery,
  defaultStatus,
  selectedYear,
  columns,
}: {
  defaultQuery: string;
  defaultStatus: string;
  selectedYear: number | "all";
  columns: Column[];
}) {
  const [status, setStatus] = useState(defaultStatus);

  const options = [
    { value: "all", label: "All statuses" },
    ...columns.map((c) => ({ value: c.status, label: c.title })),
  ];

  return (
    <form className="card mt-6 grid gap-4 p-5 md:grid-cols-[1fr_220px_auto]">
      <input type="hidden" name="year" value={selectedYear} />
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Search
        <input name="q" defaultValue={defaultQuery} className="field" placeholder="Company, role, or location" />
      </label>
      <SelectDropdown
        label="Status"
        name="status"
        value={status}
        onChange={setStatus}
        options={options}
      />
      <button type="submit" className="primary-button self-end">
        <Search className="mr-2" size={18} /> Filter
      </button>
    </form>
  );
}
