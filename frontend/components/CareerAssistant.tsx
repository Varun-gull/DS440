"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, LoaderCircle, Mic, MicOff, Send, ShieldCheck, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import type { AssistantContext, ChatMessage } from "@/lib/assistant/core";
import type { startLiveInterview } from "@/lib/assistant/live-client";

type Readiness = {
  configured: boolean; quotaReady: boolean; aiReady: boolean; voiceReady: boolean;
  model: string; voiceModel: string; textRemaining: number; voiceRemaining: number; voiceAvailableAt: string | null;
  jobs: Array<{ id: string; company: string; title: string; location: string }>;
};
type SpeechRecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: SpeechRecognitionResult) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void };
type BrowserSpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2A6384]/20 disabled:bg-slate-100";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function CareerAssistant() {
  const [ready, setReady] = useState<Readiness | null>(null);
  const [mode, setMode] = useState<"ai" | "guide">("guide");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [postingId, setPostingId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [includeResume, setIncludeResume] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [dictationConsent, setDictationConsent] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [dictationAvailable, setDictationAvailable] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [fit, setFit] = useState<AssistantContext["fit"]>(null);
  const [voiceState, setVoiceState] = useState<"off" | "connecting" | "live">("off");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [captions, setCaptions] = useState<ChatMessage[]>([]);
  const [partial, setPartial] = useState({ user: "", assistant: "" });
  const voice = useRef<Awaited<ReturnType<typeof startLiveInterview>> | null>(null);
  const voiceAbort = useRef<AbortController | null>(null);
  const sendAbort = useRef<AbortController | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/assistant", { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Could not load assistant settings.");
    if (mounted.current) setReady(value);
    return value as Readiness;
  }, []);
  useEffect(() => {
    mounted.current = true;
    const speech = window as BrowserSpeechWindow;
    setDictationAvailable(Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition));
    refresh().then((value) => { if (mounted.current && value.aiReady) setMode("ai"); })
      .catch((failure: Error) => { if (mounted.current) setError(failure.message); })
      .finally(() => { if (mounted.current) setLoading(false); });
    const hidden = () => { if (document.hidden) { voiceAbort.current?.abort(); recognition.current?.abort(); window.speechSynthesis?.cancel(); } };
    const unload = () => { voiceAbort.current?.abort(); recognition.current?.abort(); window.speechSynthesis?.cancel(); };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", unload);
    return () => { mounted.current = false; sendAbort.current?.abort(); unload(); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", unload); };
  }, [refresh]);
  useEffect(() => { if (messages.length) chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages.length]);
  useEffect(() => {
    if (voiceState !== "live") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [voiceState]);

  function contextFields() { return { postingId, jobTitle, jobDescription: postingId ? "" : jobDescription, includeResume }; }
  function clearConversation() {
    sendAbort.current?.abort(); recognition.current?.abort(); voiceAbort.current?.abort(); window.speechSynthesis?.cancel();
    setMessages([]); setCaptions([]); setPartial({ user: "", assistant: "" }); setFit(null); setQuestion(""); setError("");
  }
  async function send(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? question).trim();
    if (!text || working || voiceState !== "off") return;
    if (mode === "ai" && !aiConsent) { setError("Approve AI data processing before sending, or choose the offline guide."); return; }
    recognition.current?.abort();
    const previous = messages.slice(-10);
    const conversation = [...previous, { role: "user" as const, text }];
    setWorking(true); setError(""); setNotice("");
    sendAbort.current = new AbortController();
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: sendAbort.current.signal,
        body: JSON.stringify({ mode, consent: aiConsent, messages: conversation, ...contextFields() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The assistant could not answer.");
      if (!mounted.current || sendAbort.current.signal.aborted) return;
      setMessages((current) => [...current, { role: "user" as const, text }, { role: "assistant" as const, text: String(result.text) }].slice(-60));
      setQuestion(""); setFit(result.fit ?? null);
      if (readAloud && "speechSynthesis" in window) {
        window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(result.text); utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      }
      void refresh().catch(() => undefined);
    } catch (failure) { if (mounted.current && !sendAbort.current?.signal.aborted) setError(failure instanceof Error ? failure.message : "Request failed."); }
    finally { if (mounted.current) setWorking(false); }
  }

  function dictate() {
    if (dictating) { recognition.current?.stop(); return; }
    if (!dictationConsent) { setError("Approve your browser’s speech processing before enabling dictation."); return; }
    const speech = window as BrowserSpeechWindow; const Constructor = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    if (!Constructor) { setError("Dictation is not supported in this browser. Type your question or use live voice."); return; }
    const item = new Constructor(); item.lang = "en-US"; item.continuous = false; item.interimResults = false;
    item.onresult = (event) => { const text = Array.from(event.results).map((result) => result[0].transcript).join(" "); setQuestion((previous) => `${previous} ${text}`.trim().slice(0, 2500)); };
    item.onerror = () => { setDictating(false); setError("Dictation could not start. Check microphone permission or type your question."); };
    item.onend = () => setDictating(false);
    recognition.current = item; setError("");
    try { item.start(); setDictating(true); } catch { setDictating(false); setError("Could not start dictation."); }
  }

  async function startVoice() {
    if (voiceState !== "off" || working || !voiceConsent) return;
    setVoiceState("connecting"); setError(""); setNotice(""); setSeconds(0); setMuted(false);
    recognition.current?.abort(); window.speechSynthesis?.cancel();
    voiceAbort.current = new AbortController();
    const controller = voiceAbort.current;
    try {
      const response = await fetch("/api/assistant/voice", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ consent: voiceConsent, ...contextFields() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not start voice.");
      if (controller.signal.aborted || !mounted.current) return;
      const { startLiveInterview } = await import("@/lib/assistant/live-client");
      const connected = await startLiveInterview({ ...result,
        onCaption: (speaker, text, complete) => {
          if (!mounted.current) return;
          if (complete) { setCaptions((items) => [...items, { role: speaker, text }].slice(-40)); setPartial((current) => ({ ...current, [speaker]: "" })); }
          else setPartial((current) => ({ ...current, [speaker]: text }));
        },
        onEnded: (reason) => { if (mounted.current) { setVoiceState("off"); setMuted(false); setNotice(reason); void refresh().catch(() => undefined); } },
      }, controller.signal);
      if (controller.signal.aborted || !mounted.current) { connected.stop(); return; }
      voice.current = connected; setVoiceState("live");
    } catch (failure) {
      if (mounted.current) { setVoiceState("off"); if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Voice connection failed."); }
    }
  }

  const controlsLocked = working || voiceState !== "off";
  return <div className="mt-6 grid gap-6" data-blocks-flow={voiceState !== "off" ? "true" : undefined}>
    <div aria-live="polite">{error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}{notice && <p role="status" className="rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8] p-4 text-sm text-[#2A6384]">{notice}</p>}</div>
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.65fr)_minmax(0,1.35fr)]">
      <aside className="grid content-start gap-5">
        <section className="card p-5"><h2 className="text-lg font-bold text-slate-950">Choose your context</h2><p className="mt-2 text-sm leading-6 text-slate-600">Share only what you need. Email scanner records and other students’ data are never included.</p>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Cached job<select className={field} value={postingId} disabled={controlsLocked} onChange={(event) => { setPostingId(event.target.value); clearConversation(); }}>
            <option value="">General guidance or pasted description</option>{ready?.jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select></label>
          {!postingId && <><label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Job title<input className={field} maxLength={160} value={jobTitle} disabled={controlsLocked} onChange={(event) => setJobTitle(event.target.value)} placeholder="AI Engineer Internship" /></label>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Job description, optional<textarea className={field} rows={6} maxLength={8000} value={jobDescription} disabled={controlsLocked} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the actual responsibilities and requirements." /></label></>}
          <label className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-700"><input type="checkbox" className="mt-1.5" checked={includeResume} disabled={controlsLocked} onChange={(event) => { setIncludeResume(event.target.checked); clearConversation(); }} />Include my saved resume text</label>
          <p className="mt-2 text-xs leading-5 text-slate-500">Resume context is off by default. Contact patterns are removed where possible; review your resume for other private details. <Link className="font-semibold text-[#2A6384] underline" href="/profile">Manage resume</Link></p>
        </section>
        <section className="card p-5"><div className="flex items-center gap-2"><ShieldCheck size={19} className="text-[#2A6384]" /><h2 className="font-bold text-slate-950">Privacy and usage</h2></div><p className="mt-3 text-sm leading-6 text-slate-600">Chats and captions stay in this page’s memory, not your CareerUp database. Google processes AI chat and live voice data under its service terms. Avoid sensitive information, especially on a free API tier.</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">Daily account caps: 50 AI messages and 3 voice session reservations of up to 5 minutes. Failed provider requests can consume a reservation. Daily counts reset at midnight UTC.</p>
          {ready && <p className="mt-3 text-xs font-semibold text-[#2A6384]">{ready.textRemaining} AI messages and {ready.voiceRemaining} voice sessions remaining</p>}
        </section>
      </aside>

      <section className="card flex min-w-0 flex-col overflow-hidden" aria-labelledby="chat-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h2 id="chat-title" className="flex items-center gap-2 text-xl font-bold text-slate-950"><Bot size={22} className="text-[#2A6384]" />Career coach</h2><p className="mt-1 text-xs text-slate-500">{mode === "ai" ? "Google Gemini AI" : "Offline guide, not generative AI"}</p></div>
          <button className={secondary} disabled={working} onClick={clearConversation}><Trash2 size={16} />Clear chat</button></div>
        <div className="border-b border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap gap-2"><button className={mode === "ai" ? "primary-button" : secondary} disabled={controlsLocked || !ready?.aiReady} onClick={() => { setMode("ai"); clearConversation(); }}>AI chat</button><button className={mode === "guide" ? "primary-button" : secondary} disabled={controlsLocked} onClick={() => { setMode("guide"); clearConversation(); }}>Offline guide</button></div>
          {!loading && !ready?.aiReady && <p className="mt-3 text-xs leading-5 text-amber-800">AI chat needs a configured Gemini key and usage limit migration. The offline guide does not call an AI provider.</p>}
          {mode === "ai" && <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" className="mt-1" checked={aiConsent} disabled={controlsLocked} onChange={(event) => setAiConsent(event.target.checked)} />I agree to send this conversation, selected job details, and my resume only if enabled, to Google for AI guidance.</label>}
        </div>
        <div className="max-h-[550px] min-h-[300px] space-y-4 overflow-y-auto p-5" role="log" aria-live="polite" aria-label="Career assistant conversation">
          {!messages.length && <div className="py-6"><p className="text-xl font-bold text-slate-900">What would you like to work on?</p><p className="mt-2 text-sm leading-6 text-slate-600">Understand a fit score, improve a truthful resume bullet, or prepare an interview answer.</p><div className="mt-5 grid gap-2">{["Explain my fit for the selected job", "How can I improve my resume for this role?", "Start a mock interview for this position"].map((text) => <button key={text} className={`${secondary} justify-start text-left`} disabled={controlsLocked || loading || (mode === "ai" && !aiConsent)} onClick={() => void send(undefined, text)}>{text}</button>)}</div></div>}
          {messages.map((item, index) => <div key={index} className={`max-w-[95%] rounded-2xl p-4 ${item.role === "user" ? "ml-auto bg-[#2A6384] text-white" : "border border-slate-200 bg-slate-50 text-slate-800"}`}><p className="mb-2 text-xs font-bold opacity-70">{item.role === "user" ? "You" : mode === "ai" ? "CareerUp AI" : "Offline guide"}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{item.text}</p></div>)}
          {working && <p role="status" className="flex items-center gap-2 text-sm text-[#2A6384]"><LoaderCircle size={17} className="animate-spin" />Preparing guidance…</p>}<div ref={chatEnd} />
        </div>
        {fit && <div className="mx-5 mb-4 rounded-xl border border-[#2A6384]/20 bg-[#EAF2F8] p-3 text-xs leading-5 text-[#2A6384]"><CheckCircle2 size={15} className="mr-1 inline" />CareerUp rule based evidence coverage: <strong>{fit.score}/100</strong>. This is not a hiring probability. The chatbot does not change this score.</div>}
        <form onSubmit={(event) => void send(event)} className="mt-auto grid gap-3 border-t border-slate-200 p-4"><label className="sr-only" htmlFor="careerup-question">Ask CareerUp</label><textarea id="careerup-question" className={field} maxLength={2500} rows={3} value={question} disabled={controlsLocked} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a career question or describe an interview answer…" />
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={controlsLocked || !dictationAvailable || !dictationConsent} onClick={dictate}>{dictating ? <MicOff size={16} /> : <Mic size={16} />}{dictating ? "Stop dictation" : "Dictate"}</button><button type="button" className={secondary} onClick={() => { window.speechSynthesis?.cancel(); setReadAloud((value) => !value); }}>{readAloud ? <Volume2 size={16} /> : <VolumeX size={16} />}{readAloud ? "Read aloud on" : "Read aloud off"}</button></div><button className="primary-button gap-2 disabled:opacity-50" disabled={controlsLocked || !question.trim() || loading || (mode === "ai" && !aiConsent)}><Send size={16} />Send</button></div>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-500"><input type="checkbox" className="mt-1" checked={dictationConsent} disabled={dictating} onChange={(event) => setDictationConsent(event.target.checked)} />Enable optional browser dictation. Your browser or device provider may process speech remotely. Dictation fills the text box; it never sends a message automatically.</label>
        </form>
      </section>
    </div>

    <section className="card p-5 sm:p-6" aria-labelledby="voice-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="voice-title" className="text-xl font-bold text-slate-950">Live interview practice</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Talk with an AI interviewer using your selected job and optional resume context. You can interrupt, mute, or stop. Switching tabs stops the microphone.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${voiceState === "live" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{voiceState === "live" ? `${muted ? "Muted" : "Microphone on"} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : voiceState === "connecting" ? "Connecting" : "Microphone off"}</span></div>
      <label className="mt-4 flex max-w-4xl items-start gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600"><input type="checkbox" className="mt-1.5" checked={voiceConsent} disabled={voiceState !== "off"} onChange={(event) => setVoiceConsent(event.target.checked)} />I agree to send microphone audio and selected career context to Google for live AI practice. CareerUp does not store audio. Live captions stay on this page and may be inaccurate. Provider data handling depends on the API account’s terms and tier.</label>
      <div className="mt-4 flex flex-wrap gap-3">{voiceState === "off" ? <button className="primary-button gap-2 disabled:opacity-50" disabled={!ready?.voiceReady || !voiceConsent || working} onClick={() => void startVoice()}><Mic size={17} />Start live practice</button> : <><button className={secondary} disabled={voiceState !== "live"} onClick={() => { voice.current?.setMuted(!muted); setMuted((value) => !value); }}>{muted ? <Mic size={17} /> : <MicOff size={17} />}{muted ? "Unmute" : "Mute microphone"}</button><button className={secondary} onClick={() => voiceAbort.current?.abort()}><Square size={16} />Stop voice</button></>}</div>
      {!loading && !ready?.voiceReady && <p className="mt-3 text-xs text-amber-800">Live voice requires Gemini access, the usage limit migration, and the owner’s voice feature setting.</p>}
      {(captions.length > 0 || partial.user || partial.assistant) && <div className="mt-5 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-4" role="log" aria-label="Live voice captions" aria-live="polite">{captions.map((item, index) => <p key={index} className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700"><strong>{item.role === "user" ? "You" : "Interviewer"}:</strong> {item.text}</p>)}{partial.user && <p className="text-sm text-slate-500">You: {partial.user}</p>}{partial.assistant && <p className="text-sm text-slate-500">Interviewer: {partial.assistant}</p>}</div>}
    </section>
    <p className="text-center text-xs leading-6 text-slate-500">AI suggestions can be wrong. Verify requirements with the employer and use only truthful resume evidence. No application or email action is taken by this assistant.</p>
  </div>;
}
