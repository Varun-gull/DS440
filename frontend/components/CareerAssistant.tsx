"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, LoaderCircle, Mic, MicOff, Send, ShieldCheck, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { chatRequestMessages, type AssistantContext, type ChatMessage } from "@/lib/assistant/core";
import type { startLiveInterview } from "@/lib/assistant/live-client";
import { InterviewAvatar, type InterviewPhase } from "@/components/InterviewAvatar";

type Readiness = {
  configured: boolean; quotaReady: boolean; aiReady: boolean; voiceReady: boolean;
  model: string; voiceModel: string; textRemaining: number; voiceRemaining: number; rewardVoiceCredits: number; voiceAvailableAt: string | null;
  jobs: Array<{ id: string; company: string; title: string; location: string }>;
};
type SpeechRecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: SpeechRecognitionResult) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void };
type BrowserSpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2456a6]/20 disabled:bg-slate-100";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function CareerAssistant({ view = "chat" }: { view?: "chat" | "live" }) {
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
  const [contextExpanded, setContextExpanded] = useState(false);
  const [dictationConsent, setDictationConsent] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [dictationAvailable, setDictationAvailable] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [fit, setFit] = useState<AssistantContext["fit"]>(null);
  const [voiceState, setVoiceState] = useState<"off" | "connecting" | "queued" | "live">("off");
  const [muted, setMuted] = useState(false);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);
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
    const text = (preset ?? question).trim().slice(0, 2500);
    if (!text || working || voiceState !== "off") return;
    if (mode === "ai" && !aiConsent) { setError("Approve AI data processing before sending, or choose the offline guide."); return; }
    recognition.current?.abort();
    const conversation = chatRequestMessages(messages, text);
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
    setVoiceState("connecting"); setError(""); setNotice(""); setSeconds(0); setMuted(false); setInterviewerSpeaking(false);
    setCaptions([]); setPartial({ user: "", assistant: "" });
    recognition.current?.abort(); window.speechSynthesis?.cancel();
    const controller = new AbortController(); voiceAbort.current = controller;
    const requestId = crypto.randomUUID();
    let microphoneStream: MediaStream | null = null;
    let released = false;
    const release = () => {
      if (released) return; released = true;
      void (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try { await fetch("/api/assistant/voice", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave", requestId }) }); return; }
          catch { if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500)); }
        }
      })();
    };
    controller.signal.addEventListener("abort", release, { once: true });
    const wait = (ms: number) => new Promise<void>((resolve, reject) => {
      if (controller.signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
      const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
      const timer = setTimeout(() => { controller.signal.removeEventListener("abort", abort); resolve(); }, ms);
      controller.signal.addEventListener("abort", abort, { once: true });
    });
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error("Live voice needs HTTPS or localhost, a microphone, and AudioWorklet support.");
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (controller.signal.aborted || !mounted.current) return;
      let result; let networkRetries = 0;
      while (!controller.signal.aborted && mounted.current) {
        let response;
        try {
          response = await fetch("/api/assistant/voice", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
            body: JSON.stringify({ requestId, consent: voiceConsent, ...contextFields() }) });
          result = await response.json();
          networkRetries = 0;
        } catch (failure) {
          if (controller.signal.aborted) throw failure;
          if (++networkRetries > 2) throw new Error("The connection was interrupted. Your microphone is off. Please try live practice again.");
          microphoneStream?.getTracks().forEach((track) => track.stop()); microphoneStream = null;
          setVoiceState("queued"); setNotice("Connection interrupted. Retrying your place with the microphone off…");
          await wait(1500); continue;
        }
        if (!response.ok) throw new Error(result.error ?? "Could not start voice.");
        if (!result.queued) break;
        // Permission is checked before a credit is spent, but no audio is kept
        // running while the student waits for shared provider capacity.
        microphoneStream?.getTracks().forEach((track) => track.stop()); microphoneStream = null;
        setVoiceState("queued");
        setNotice(result.position > 0 ? `You are number ${result.position} in the live practice queue. Three students can practise at once. Your microphone is off and no session or credit is used while you wait. Keep this page open, or choose Leave queue.` : "Preparing your live interview. Your microphone is off until the connection is ready…");
        await wait(result.pollAfterSeconds === 2 ? 2000 : 5000);
      }
      if (controller.signal.aborted || !mounted.current || !result) return;
      setVoiceState("connecting"); setNotice("");
      microphoneStream ??= await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (controller.signal.aborted || !mounted.current) return;
      const { startLiveInterview } = await import("@/lib/assistant/live-client");
      const connected = await startLiveInterview({ ...result, microphoneStream,
        onCaption: (speaker, text, complete) => {
          if (!mounted.current) return;
          if (complete) { setCaptions((items) => [...items, { role: speaker, text }].slice(-40)); setPartial((current) => ({ ...current, [speaker]: "" })); }
          else setPartial((current) => ({ ...current, [speaker]: text }));
        },
        onSpeakingChange: (speaking) => { if (mounted.current) setInterviewerSpeaking(speaking); },
        onEnded: (reason) => { release(); if (mounted.current) { setVoiceState("off"); setMuted(false); setInterviewerSpeaking(false); setNotice(reason); void refresh().catch(() => undefined); } },
      }, controller.signal);
      microphoneStream = null;
      if (controller.signal.aborted || !mounted.current) { connected.stop(); return; }
      voice.current = connected; setVoiceState("live");
    } catch (failure) {
      release();
      if (mounted.current) { setVoiceState("off"); setInterviewerSpeaking(false); if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Voice connection failed."); }
    } finally {
      microphoneStream?.getTracks().forEach((track) => track.stop());
      if (controller.signal.aborted || !mounted.current) { release(); if (mounted.current) { setVoiceState("off"); setNotice("You left live practice. Your microphone is off."); } }
      if (mounted.current) void refresh().catch(() => undefined);
    }
  }

  const controlsLocked = working || voiceState !== "off";
  const phase: InterviewPhase = voiceState === "off" ? "ready" : voiceState === "connecting" ? "connecting" : voiceState === "queued" ? "queued" : interviewerSpeaking ? "speaking" : muted ? "muted" : "listening";
  const presentation = {
    ready: { label: "Microphone off", title: "Meet your AI interviewer", detail: "Choose your role, settle in, and practice a real conversation at your own pace." },
    connecting: { label: "Connecting", title: "Getting your interviewer ready", detail: "Your interview will begin as soon as the secure voice connection is ready." },
    queued: { label: "Microphone off", title: "Your place is saved", detail: "Waiting for an available interviewer. Your microphone stays off while you wait." },
    listening: { label: "Listening to you", title: "Your turn. Take your time.", detail: "Speak naturally. Your AI interviewer will respond when you finish." },
    speaking: { label: "Interviewer speaking", title: "A conversation, one step at a time", detail: "Listen to the question or interrupt if you would like to clarify something." },
    muted: { label: "Microphone muted", title: "Take a moment", detail: "You can still hear your interviewer. Unmute when you are ready to speak." },
  }[phase];
  const selectedRole = ready?.jobs.find(job => job.id === postingId)?.title || jobTitle.trim() || "General interview practice";
  const remainingSeconds = Math.max(0, 300 - seconds);
  const contextPanel = <section className="card p-5 coach-context" data-expanded={contextExpanded ? "true" : "false"}><button type="button" className="coach-context-toggle" aria-expanded={contextExpanded} aria-controls="coach-context-fields" onClick={() => setContextExpanded(value => !value)}><span>Add a role or resume<small>Optional personalization</small></span><span aria-hidden>{contextExpanded ? "−" : "+"}</span></button><div id="coach-context-fields" className="coach-context-fields"><h2 className="text-lg font-bold text-slate-950">{view === "live" ? "Personalize your practice" : "Your career context"}</h2><p className="mt-2 text-sm leading-6 text-slate-600">Share only what you need. Email scanner records and other students’ data are never included.</p>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Choose a job<select className={field} value={postingId} disabled={controlsLocked} onChange={(event) => { setPostingId(event.target.value); clearConversation(); }}>
            <option value="">General guidance or pasted description</option>{ready?.jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select></label>
          {!postingId && <><label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Job title<input className={field} maxLength={160} value={jobTitle} disabled={controlsLocked} onChange={(event) => setJobTitle(event.target.value)} placeholder="AI Engineer Internship" /></label>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Job description, optional<textarea className={field} rows={4} maxLength={8000} value={jobDescription} disabled={controlsLocked} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the actual responsibilities and requirements." /></label></>}
          <label className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-700"><input type="checkbox" className="mt-1.5" checked={includeResume} disabled={controlsLocked} onChange={(event) => { setIncludeResume(event.target.checked); clearConversation(); }} />Include my saved resume text</label>
          <p className="mt-2 text-xs leading-5 text-slate-500">Resume context is off by default. Contact patterns are removed where possible; review your resume for other private details. <Link className="font-semibold text-[#2456a6] underline" href="/profile">Manage resume</Link></p>
        </div></section>;
  const privacyPanel = <details className="card p-5 coach-privacy">
    <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[#142b49]"><ShieldCheck size={18} aria-hidden />Privacy and usage</summary>
    <div className="mt-4 space-y-3 text-xs leading-6 text-slate-600">
      <p>Chats and captions stay in this page’s memory, not your CareerUp database. Google processes AI chat and live voice under its service terms. Google’s free tier may use inputs and outputs to improve its services, including human review. Use anonymized examples and avoid personal or confidential information. Read the Privacy Policy for details.</p>
      <p>Each account has 50 AI messages and 3 voice sessions per day. Sessions last up to 5 minutes. Reward Points can unlock extra voice credits, with a limit of 10 sessions per day. Daily allowances reset at midnight UTC. The app’s free AI allowance is shared, so busy requests may wait.</p>
      {ready && <p className="font-semibold text-[#2456a6]">{ready.textRemaining} AI messages and {ready.voiceRemaining} voice sessions remaining</p>}
      {ready && <Link href="/rewards?tab=library" className="inline-flex font-semibold text-[#2456a6] underline">{ready.rewardVoiceCredits || 0} extra voice credits · Visit rewards</Link>}
    </div>
  </details>;
  const chatPanel = <section className="coach-chat-panel card flex min-w-0 flex-col overflow-hidden" aria-labelledby="chat-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h2 id="chat-title" className="flex items-center gap-2 text-xl font-bold text-slate-950"><Bot size={22} className="text-[#2456a6]" />CareerUp AI</h2><p className="mt-1 text-xs text-slate-500">{loading ? "Getting your coach ready…" : mode === "ai" ? "Google Gemini AI" : "Offline guide, not generative AI"}</p></div>
          <button className={secondary} disabled={working} onClick={clearConversation}><Trash2 size={16} />Clear chat</button></div>
        <div className="border-b border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap gap-2"><button className={mode === "ai" ? "primary-button" : secondary} disabled={controlsLocked || !ready?.aiReady} onClick={() => { setMode("ai"); clearConversation(); }}>AI chat</button><button className={mode === "guide" ? "primary-button" : secondary} disabled={controlsLocked} onClick={() => { setMode("guide"); clearConversation(); }}>Offline guide</button></div>
          {!loading && !ready?.aiReady && <p className="mt-3 text-xs leading-5 text-amber-800">AI chat is temporarily unavailable. You can still use the offline guide for basic career tips.</p>}
          {mode === "ai" && <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" className="mt-1" checked={aiConsent} disabled={controlsLocked} onChange={(event) => setAiConsent(event.target.checked)} />I agree to send this conversation, selected job details, and my resume only if enabled, to Google for AI guidance. Google’s free tier may use inputs and outputs to improve services, including human review. Use anonymized examples and avoid personal or confidential information.</label>}
        </div>
        <div className="max-h-[550px] min-h-[300px] space-y-4 overflow-y-auto p-5" role="log" aria-live="polite" aria-label="Career assistant conversation">
          {!messages.length && <div className="py-6"><p className="text-xl font-bold text-slate-900">What would you like to work on?</p><p className="mt-2 text-sm leading-6 text-slate-600">Understand a fit score, improve a truthful resume bullet, or prepare an interview answer.</p><div className="mt-5 grid gap-2">{["Explain my fit for the selected job", "How can I improve my resume for this role?", "Start a mock interview for this position"].map((text) => <button key={text} className={`${secondary} justify-start text-left`} disabled={controlsLocked || loading || (mode === "ai" && !aiConsent)} onClick={() => void send(undefined, text)}>{text}</button>)}</div></div>}
          {messages.map((item, index) => <div key={index} className={`max-w-[95%] rounded-2xl p-4 ${item.role === "user" ? "ml-auto bg-[#2456a6] text-white" : "border border-slate-200 bg-slate-50 text-slate-800"}`}><p className="mb-2 text-xs font-bold opacity-70">{item.role === "user" ? "You" : mode === "ai" ? "CareerUp AI" : "Offline guide"}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{item.text}</p></div>)}
          {working && <p role="status" className="flex items-center gap-2 text-sm text-[#2456a6]"><LoaderCircle size={17} className="animate-spin" />Preparing guidance. Busy requests may take up to four minutes…</p>}<div ref={chatEnd} />
        </div>
        {fit && <div className="mx-5 mb-4 rounded-xl border border-[#2456a6]/20 bg-[#eef3fc] p-3 text-xs leading-5 text-[#2456a6]"><CheckCircle2 size={15} className="mr-1 inline" />CareerUp rule based evidence coverage: <strong>{fit.score}/100</strong>. This is not a hiring probability. The chatbot does not change this score.</div>}
        <form onSubmit={(event) => void send(event)} className="mt-auto grid gap-3 border-t border-slate-200 p-4"><label className="sr-only" htmlFor="careerup-question">Ask CareerUp</label><textarea id="careerup-question" className={field} maxLength={2500} rows={3} value={question} disabled={controlsLocked} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a career question or describe an interview answer…" />
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={controlsLocked || !dictationAvailable || !dictationConsent} onClick={dictate}>{dictating ? <MicOff size={16} /> : <Mic size={16} />}{dictating ? "Stop dictation" : "Dictate"}</button><button type="button" className={secondary} onClick={() => { window.speechSynthesis?.cancel(); setReadAloud((value) => !value); }}>{readAloud ? <Volume2 size={16} /> : <VolumeX size={16} />}{readAloud ? "Read aloud on" : "Read aloud off"}</button></div><button className="primary-button gap-2 disabled:opacity-50" disabled={controlsLocked || !question.trim() || loading || (mode === "ai" && !aiConsent)}><Send size={16} />Send</button></div>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-500"><input type="checkbox" className="mt-1" checked={dictationConsent} disabled={dictating} onChange={(event) => setDictationConsent(event.target.checked)} />Enable optional browser dictation. Your browser or device provider may process speech remotely. Dictation fills the text box; it never sends a message automatically.</label>
        </form>
      </section>;
  return <div className="coach-workspace" data-blocks-flow="true">
    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded-2xl border border-[#2456a6]/20 bg-[#eef3fc] p-4 text-sm text-[#2456a6]">{notice}</p>}
    {view === "chat" ? <div className="coach-chat-layout"><aside className="grid content-start gap-5">{contextPanel}{privacyPanel}<Link href="/coach/live" className="coach-live-invite"><Mic size={20} aria-hidden /><span><strong>Prefer to talk?</strong><small>Try a live practice interview</small></span><span aria-hidden>↗</span></Link></aside>{chatPanel}</div> : <>
      <div className={voiceState === "off" ? "coach-live-layout" : "coach-live-focus"}>
        {voiceState === "off" && <aside className="grid content-start gap-5">{contextPanel}{privacyPanel}</aside>}
        <section className="interview-room" data-active={voiceState !== "off" ? "true" : undefined} aria-labelledby="voice-title">
          <header className="interview-room-header"><div><p className="interview-room-eyebrow">CareerUp AI interviewer</p><p className="interview-room-role">{selectedRole}</p></div><span className="interview-mic-status">{voiceState === "live" ? <>{muted ? <MicOff size={14} aria-hidden /> : <Mic size={14} aria-hidden />}{muted ? "Muted" : "Microphone on"}<span className="tabular-nums">{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")} left</span></> : voiceState === "queued" ? "In queue · microphone off" : "Up to 5 minutes"}</span></header>
          <div className="interview-room-center">
            <InterviewAvatar phase={phase} />
            <p className="interview-activity" role="status" aria-live="polite">{(phase === "connecting" || phase === "queued") && <LoaderCircle size={15} className="animate-spin" aria-hidden />}{presentation.label}</p>
            <h2 id="voice-title">{presentation.title}</h2>
            <p className="interview-room-description">{presentation.detail}</p>
            {voiceState === "off" && <label className="interview-consent"><input type="checkbox" checked={voiceConsent} onChange={event => setVoiceConsent(event.target.checked)} /> <span>I agree to send microphone audio and selected career context to Google for live AI practice. CareerUp does not store audio. Live captions stay on this page and may be inaccurate. Google’s free tier may use inputs and responses to improve its services, including human review. Use anonymized examples and avoid personal or confidential information.</span></label>}
            <div className="interview-controls">
              {voiceState === "off" ? <button type="button" className="interview-start" disabled={loading || !ready?.voiceReady || !voiceConsent} onClick={() => void startVoice()}><Mic size={20} aria-hidden />{loading ? "Getting ready…" : "Start live interview"}</button> : <>
                {voiceState === "live" && <button type="button" className="interview-mute" aria-pressed={muted} onClick={() => { voice.current?.setMuted(!muted); setMuted(value => !value); }}>{muted ? <Mic size={20} aria-hidden /> : <MicOff size={20} aria-hidden />}{muted ? "Unmute" : "Mute microphone"}</button>}
                <button type="button" className="interview-stop" onClick={() => voiceAbort.current?.abort()}><Square size={17} aria-hidden />{voiceState === "queued" ? "Leave queue" : voiceState === "connecting" ? "Cancel" : "End interview"}</button>
              </>}
            </div>
            {!loading && !ready?.voiceReady && <p className="mt-3 text-sm text-amber-800">Live interview practice is temporarily unavailable. You can still use the <Link href="/coach" className="font-semibold underline">chat coach</Link>.</p>}
            {voiceState === "off" && <p className="interview-hint">Your microphone only turns on after you start and allow access.</p>}
          </div>
          <footer className="interview-room-footer"><ShieldCheck size={15} aria-hidden /><span>{voiceState === "off" ? "Resume sharing is optional. You choose what your interviewer sees." : "Leaving this page stops the microphone and ends your place in the session."}</span></footer>
        </section>
      </div>
      {(captions.length > 0 || partial.user || partial.assistant) && <section className="card overflow-hidden" aria-labelledby="live-captions-title"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 id="live-captions-title" className="font-bold text-[#142b49]">Live captions</h2><p className="mt-1 text-xs text-slate-500">A transcript of this session, visible only on this page. Captions may be inaccurate.</p></div>{voiceState === "off" && <button type="button" className={secondary} onClick={() => { setCaptions([]); setPartial({ user: "", assistant: "" }); }}><Trash2 size={14} aria-hidden />Clear captions</button>}</div><div className="max-h-72 space-y-4 overflow-y-auto p-5" role="log" aria-label="Live voice captions" aria-live="polite">{captions.map((item, index) => <p key={index} className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700"><strong>{item.role === "user" ? "You" : "Interviewer"}:</strong> {item.text}</p>)}{partial.user && <p className="text-sm leading-6 text-slate-500"><strong>You:</strong> {partial.user}</p>}{partial.assistant && <p className="text-sm leading-6 text-slate-500"><strong>Interviewer:</strong> {partial.assistant}</p>}</div></section>}
      {voiceState !== "off" && privacyPanel}
    </>}
    <p className="text-center text-xs leading-6 text-slate-500">AI suggestions can be wrong. Use truthful resume evidence and verify requirements with the employer. The coach never submits applications or changes your emails.</p>
  </div>;
}
