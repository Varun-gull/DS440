"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, RotateCcw, Send, ShieldCheck } from "lucide-react";
import type { ChatMessage } from "@/lib/assistant/core";

type Readiness = { aiReady: boolean; textRemaining: number };
const prompts = ["Help me improve my resume", "Practice an interview question", "Plan my next application"];

export default function CareerCoachChat() {
  const [ready, setReady] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"ai" | "guide">("guide");
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [access, setAccess] = useState<"login" | "mfa" | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setAccess(null);
      try {
        const response = await fetch("/api/assistant", { cache: "no-store", signal: controller.signal });
        const value = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (response.status === 401) setAccess("login");
          if (response.status === 403 && /two factor/i.test(value.error ?? "")) setAccess("mfa");
          throw new Error(value.error || "Your coach could not load. Please try connecting again.");
        }
        setReady(value);
        setMode(value.aiReady ? "ai" : "guide");
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Your coach could not load.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); request.current?.abort(); };
  }, [connectionAttempt]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, working]);

  const canSend = !loading && Boolean(ready) && !working && (mode !== "ai" || (consent && ready!.textRemaining > 0));

  async function send(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? question).trim().slice(0, 2500);
    if (!text || !canSend || sending.current) return;
    sending.current = true;
    setWorking(true); setError("");
    const controller = new AbortController();
    request.current = controller;
    // Preserve complete turns while staying below the existing API's length limits.
    const history = messages.slice(-8).map((message) => ({ ...message, text: message.text.slice(0, 1500) }));
    try {
      const response = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ mode, consent, includeResume: false, messages: [...history, { role: "user", text }] }),
      });
      const value = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 401) setAccess("login");
        if (response.status === 403 && /two factor/i.test(value.error ?? "")) setAccess("mfa");
        throw new Error(value.error || "Your message could not be sent. Please try again.");
      }
      if (typeof value.text !== "string" || !value.text.trim()) throw new Error("The coach returned an empty reply. Please try again.");
      setMessages((current) => [...current, { role: "user" as const, text }, { role: "assistant" as const, text: value.text }].slice(-60));
      setQuestion("");
      if (mode === "ai") setReady((current) => current ? { ...current, textRemaining: Math.max(0, current.textRemaining - 1) } : current);
      input.current?.focus({ preventScroll: true });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Your message could not be sent.");
    } finally {
      sending.current = false;
      if (!controller.signal.aborted) setWorking(false);
    }
  }

  function switchMode() {
    setMode((current) => current === "ai" ? "guide" : "ai");
    setMessages([]); setError("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs">
        <span className="font-semibold text-[#2A6384]">{loading ? "Connecting…" : ready ? mode === "ai" ? "Gemini AI" : "Offline guide · not generative AI" : "Connection unavailable"}</span>
        <div className="flex items-center gap-2">
          {ready?.aiReady && <button type="button" onClick={switchMode} disabled={working} className="rounded-md px-1 py-1 font-medium text-slate-600 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2A6384] disabled:opacity-50">{mode === "ai" ? "Use offline guide" : "Use AI chat"}</button>}
          {messages.length > 0 && <button type="button" aria-label="Clear chat" title="Clear chat" onClick={() => { setMessages([]); setError(""); }} disabled={working} className="career-coach-icon-button !h-8 !w-8"><RotateCcw size={14} aria-hidden /></button>}
        </div>
      </div>

      <div ref={log} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-label="AI coach conversation" aria-live="polite" aria-busy={working}>
        {loading ? <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" aria-hidden />Getting your coach ready…</p> : !messages.length && ready ? <div>
          <p className="text-lg font-bold text-slate-950">What’s your next move?</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Let’s work on your resume, prepare for an interview, or make your job search feel more manageable.</p>
          {!ready.aiReady && <p className="mt-3 text-xs leading-5 text-slate-500">AI chat is currently unavailable. The offline guide offers basic career tips.</p>}
          <div className="mt-4 grid gap-2">{prompts.map((text) => <button type="button" key={text} onClick={() => void send(undefined, text)} disabled={!canSend} className="rounded-xl border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-[#2A6384] transition-colors hover:border-[#2A6384]/40 hover:bg-[#EAF2F8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2A6384] disabled:cursor-not-allowed disabled:opacity-50">{text}</button>)}</div>
        </div> : null}
        {messages.map((message, index) => <div key={index} className={`max-w-[95%] rounded-2xl px-3.5 py-3 ${message.role === "user" ? "ml-auto bg-[#2A6384] text-white" : "bg-slate-100 text-slate-800"}`}>
          <p className="mb-1 text-[11px] font-bold opacity-70">{message.role === "user" ? "You" : mode === "ai" ? "CareerUp AI" : "Offline guide"}</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
        </div>)}
        {working && <p role="status" className="flex items-center gap-2 text-xs text-[#2A6384]"><LoaderCircle size={15} className="animate-spin" aria-hidden />Thinking through your next step…</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">{error}</p>}
        {access && <Link className="inline-flex rounded-xl bg-[#2A6384] px-4 py-2.5 text-sm font-semibold text-white" href={access === "login" ? "/login" : "/mfa?next=%2Finterview%2Fassistant"}>{access === "login" ? "Sign in to chat" : "Complete two factor verification"}</Link>}
        {!loading && !ready && !access && <button type="button" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-[#2A6384]" onClick={() => setConnectionAttempt((current) => current + 1)}>Try connecting again</button>}
      </div>

      {ready && <form onSubmit={(event) => void send(event)} className="shrink-0 space-y-2.5 border-t border-slate-200 bg-white p-3">
        {mode === "ai" && <label className="flex items-start gap-2 px-1 text-[11px] leading-4 text-slate-600"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={working} className="mt-0.5 accent-[#2A6384]" />I agree to send this chat and my career preferences to Google.</label>}
        {mode === "ai" && ready.textRemaining === 0 && <p role="status" className="px-1 text-xs text-amber-800">You’ve used today’s AI messages. You can still use the offline guide.</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-[#2A6384] focus-within:ring-2 focus-within:ring-[#2A6384]/10">
          <label htmlFor="careerup-quick-question" className="sr-only">Message your career coach</label>
          <textarea ref={input} id="careerup-quick-question" rows={2} maxLength={2500} value={question} onChange={(event) => setQuestion(event.target.value)} disabled={working} placeholder={mode === "ai" && !consent ? "Approve AI guidance above to start" : "Ask your career coach…"} className="max-h-28 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
          <button type="submit" aria-label="Send message" disabled={!canSend || !question.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2A6384] text-white transition-colors hover:bg-[#214E69] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2A6384] disabled:cursor-not-allowed disabled:opacity-40">{working ? <LoaderCircle size={17} className="animate-spin" aria-hidden /> : <Send size={17} aria-hidden />}</button>
        </div>
        <p className="flex items-center justify-center gap-1 text-[10px] leading-4 text-slate-500"><ShieldCheck size={12} aria-hidden />Saved resumes and emails aren’t included. <Link className="font-semibold text-[#2A6384] underline" href="/interview/assistant">Full coach</Link></p>
      </form>}
    </div>
  );
}
