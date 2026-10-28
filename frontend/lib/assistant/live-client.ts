"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { pcm16Bytes, pcm16Floats, resamplePcm16 } from "./audio";

export type LiveOptions = {
  token: string; model: string; expiresAt: string;
  onCaption: (speaker: "user" | "assistant", text: string, complete: boolean) => void;
  onEnded: (reason: string) => void;
};

export async function startLiveInterview(options: LiveOptions, signal: AbortSignal) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error("Live voice needs HTTPS or localhost, a microphone, and AudioWorklet support.");
  let session: Session | null = null;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let microphone: AudioWorkletNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let playbackEnd = 0;
  const playing = new Set<AudioBufferSourceNode>();
  const captions = { user: "", assistant: "" };
  let muted = false;

  function stopPlayback() {
    for (const node of playing) { try { node.stop(); } catch { /* already ended */ } }
    playing.clear(); playbackEnd = 0;
  }
  function flushCaptions() {
    for (const speaker of ["user", "assistant"] as const) if (captions[speaker]) {
      options.onCaption(speaker, captions[speaker], true); captions[speaker] = "";
    }
  }
  function stop(reason = "Voice session ended.") {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    signal.removeEventListener("abort", aborted);
    microphone?.disconnect(); source?.disconnect(); stream?.getTracks().forEach((track) => track.stop());
    session?.close(); stopPlayback(); flushCaptions();
    void context?.close().catch(() => undefined);
    options.onEnded(reason);
  }
  const aborted = () => stop("Voice stopped. Your microphone is off.");
  signal.addEventListener("abort", aborted, { once: true });

  function message(event: LiveServerMessage) {
    if (closed || !context) return;
    const content = event.serverContent;
    if (content?.interrupted) { stopPlayback(); flushCaptions(); }
    if (content?.inputTranscription?.text) {
      captions.user += content.inputTranscription.text;
      options.onCaption("user", captions.user.slice(-5000), false);
    }
    if (content?.outputTranscription?.text) {
      captions.assistant += content.outputTranscription.text;
      options.onCaption("assistant", captions.assistant.slice(-5000), false);
    }
    for (const part of content?.modelTurn?.parts ?? []) {
      const data = part.inlineData;
      if (!data?.data || !data.mimeType?.startsWith("audio/pcm")) continue;
      const raw = Uint8Array.from(atob(data.data), (character) => character.charCodeAt(0));
      const floats = pcm16Floats(raw);
      const sampleRate = Number(data.mimeType.match(/rate=(\d+)/)?.[1] ?? 24000);
      if (sampleRate < 8000 || sampleRate > 48000 || floats.length > 240000) continue;
      const buffer = context.createBuffer(1, floats.length, sampleRate);
      buffer.copyToChannel(new Float32Array(floats), 0);
      const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination);
      playbackEnd = Math.max(playbackEnd, context.currentTime);
      if (playbackEnd - context.currentTime > 15) { stopPlayback(); playbackEnd = context.currentTime; }
      node.start(playbackEnd); playbackEnd += buffer.duration;
      playing.add(node); node.onended = () => playing.delete(node);
    }
    if (content?.turnComplete) flushCaptions();
    if (event.goAway) stop("The provider ended this session. Start another session when available.");
  }

  try {
    if (signal.aborted) throw new Error("Voice start cancelled.");
    // The user click and disclosure precede this browser permission prompt.
    context = new AudioContext();
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (closed || signal.aborted) { stream.getTracks().forEach((track) => track.stop()); throw new Error("Voice start cancelled."); }
    await context.audioWorklet.addModule("/careerup-microphone.js");
    if (closed || signal.aborted) throw new Error("Voice start cancelled.");
    const ai = new GoogleGenAI({ apiKey: options.token, httpOptions: { apiVersion: "v1beta" } });
    const connected = await ai.live.connect({ model: options.model, config: { responseModalities: [Modality.AUDIO] }, callbacks: {
      onmessage: (event) => { try { message(event); } catch { stop("Voice audio could not be decoded. Please try again."); } },
      onerror: () => stop("The voice connection failed. Your microphone has been stopped."),
      onclose: () => stop("Voice connection closed. Your microphone is off."),
    } });
    if (closed || signal.aborted) { connected.close(); throw new Error("Voice start cancelled."); }
    session = connected;
    source = context.createMediaStreamSource(stream);
    microphone = new AudioWorkletNode(context, "careerup-microphone");
    const silence = context.createGain(); silence.gain.value = 0;
    microphone.connect(silence); silence.connect(context.destination); source.connect(microphone);
    const inputRate = context.sampleRate;
    microphone.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (closed || muted || !session) return;
      const bytes = pcm16Bytes(resamplePcm16(event.data, inputRate));
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      session.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" } });
    };
    const remaining = Math.max(0, Date.parse(options.expiresAt) - Date.now());
    timer = setTimeout(() => stop("Your five minute session is complete. Your microphone is off."), Math.min(remaining, 300000));
    session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Begin a mock interview for the selected role. Ask one concise opening question and wait for my answer." }] }], turnComplete: true });
    return { stop, setMuted(value: boolean) {
      muted = value;
      stream?.getAudioTracks().forEach((track) => { track.enabled = !value; });
      if (value) session?.sendRealtimeInput({ audioStreamEnd: true });
    } };
  } catch (error) { stop("Voice could not start. Your microphone is off."); throw error; }
}
