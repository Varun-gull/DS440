"use client";

import { ChevronDown, Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = { label: string; value: string };

type Props = {
  label?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
};

export function SelectDropdown({ label, name, value, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((o) => o.value === value);

  function toggle() {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function update() {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    }
    function handleClickOutside(e: Event) {
      if (!btnRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("focusin", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("focusin", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }, [open]);

  const dropdown = open && rect ? createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="listbox"
      aria-label={label || name}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); btnRef.current?.focus(); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        }
      }}
      style={{
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 160),
        zIndex: 9999,
      }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-strong"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="option"
          aria-selected={opt.value === value}
          onClick={() => { onChange(opt.value); setOpen(false); btnRef.current?.focus(); }}
          className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-[#EFF7F3] hover:text-slate-950 focus:bg-[#EFF7F3]"
        >
          {opt.label}
          {opt.value === value && <Check size={14} className="text-[#23675D]" />}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <label className={label ? "grid gap-2 text-sm font-bold text-slate-700" : "block"}>
      {label && <span>{label}</span>}
      {/* Hidden input so the value is included in form submissions */}
      <input type="hidden" name={name} value={value} />
      <button
        ref={btnRef}
        type="button"
        aria-label={label || name}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!open) toggle(); } }}
        className="field flex items-center justify-between gap-2 text-left"
      >
        <span>{selected?.label ?? "Select…"}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {dropdown}
    </label>
  );
}
