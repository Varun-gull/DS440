"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

type MultiSelectOption = {
  label: string;
  value: string;
};

type MultiSelectFieldProps = {
  label: string;
  name: string;
  options: MultiSelectOption[];
  initialValues: string[];
  placeholder: string;
  onValuesChange?: (values: string[]) => void;
};

function normalizeItems(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function MultiSelectField({ label, name, options, initialValues, placeholder, onValuesChange }: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [selectedValues, setSelectedValues] = useState(() => normalizeItems(initialValues).slice(0, 8));

  const normalizedSelected = useMemo(() => {
    const seen = new Set<string>();
    return selectedValues.filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedValues]);

  function toggleOption(value: string) {
    setSelectedValues((current) => {
      const exists = current.some((item) => item.toLowerCase() === value.toLowerCase());
      const nextValues = exists ? current.filter((item) => item.toLowerCase() !== value.toLowerCase()) : [...current, value].slice(0, 8);
      onValuesChange?.(nextValues);
      return nextValues;
    });
  }

  function removeValue(value: string) {
    setSelectedValues((current) => {
      const nextValues = current.filter((item) => item.toLowerCase() !== value.toLowerCase());
      onValuesChange?.(nextValues);
      return nextValues;
    });
  }

  function addCustomValue() {
    const cleanValue = customValue.trim();
    if (!cleanValue) return;
    setSelectedValues((current) => {
      const exists = current.some((item) => item.toLowerCase() === cleanValue.toLowerCase());
      if (exists) return current;
      const nextValues = [...current, cleanValue].slice(0, 8);
      onValuesChange?.(nextValues);
      return nextValues;
    });
    setCustomValue("");
  }

  return (
    <div className="grid gap-2 text-sm font-bold text-slate-700">
      <span>{label}</span>
      <input type="hidden" name={name} value={normalizedSelected.join(", ")} />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="field flex min-h-[3.5rem] w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-2">
            {normalizedSelected.length > 0 ? (
              normalizedSelected.map((value) => (
                <span key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                  <span className="truncate">{value}</span>
                </span>
              ))
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </span>
          <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-strong">
            <div className="grid max-h-64 gap-1 overflow-y-auto pr-1">
              {options.map((option) => {
                const selected = normalizedSelected.some((item) => item.toLowerCase() === option.value.toLowerCase());
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                      selected ? "bg-[#EAF2F8] text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <span>{option.label}</span>
                    {selected && <Check size={16} className="text-[#2A6384]" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <input
                value={customValue}
                onChange={(event) => setCustomValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomValue();
                  }
                }}
                className="field min-h-10 flex-1 rounded-xl py-2 text-sm"
                placeholder="Add custom option"
              />
              <button type="button" onClick={addCustomValue} className="secondary-button min-h-10 rounded-xl px-3" aria-label={`Add custom ${label.toLowerCase()}`}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      {normalizedSelected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {normalizedSelected.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => removeValue(value)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-sky/50 hover:text-slate-950"
            >
              {value}
              <X size={13} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
