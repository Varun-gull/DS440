import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const audioCode = ts.transpileModule(readFileSync(new URL("../lib/assistant/audio.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const audioExports = {};
vm.runInNewContext(audioCode, { exports: audioExports });
const clientCode = ts.transpileModule(readFileSync(new URL("../lib/assistant/live-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let passed = 0;
async function check(label, run) { await run(); passed++; console.log(`PASS ${label}`); }

async function browser() {
  const nodes = [], captions = [], ended = [], input = [];
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  let context, callbacks, permissionRequests = 0, connectionClosed = false, worklet;
  class AudioContext {
    constructor() { context = this; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; this.audioWorklet = { addModule: async () => {} }; }
    async resume() {}
    async close() { this.closed = true; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createBuffer(_channels, length, sampleRate) { return { duration: length / sampleRate, copyToChannel() {} }; }
    createBufferSource() {
      const node = { stopped: false, connect() {}, start(time) { this.startTime = time; }, stop() { this.stopped = true; } };
      nodes.push(node); return node;
    }
  }
  class AudioWorkletNode { constructor() { worklet = this; this.port = {}; } connect() {} disconnect() { this.disconnected = true; } }
  class GoogleGenAI {
    live = { connect: async (options) => {
      callbacks = options.callbacks;
      return { close() { connectionClosed = true; }, sendClientContent() {}, sendRealtimeInput(value) { input.push(value); } };
    } };
  }
  const exports = {};
  vm.runInNewContext(clientCode, {
    exports, require: (name) => {
      if (name === "@google/genai") return { GoogleGenAI, Modality: { AUDIO: "AUDIO" } };
      if (name === "./audio") return audioExports;
      throw Error(`Unexpected client import ${name}`);
    },
    window: { isSecureContext: true, AudioWorkletNode }, AudioContext, AudioWorkletNode,
    navigator: { mediaDevices: { getUserMedia: async () => { permissionRequests++; return stream; } } },
    setTimeout, clearTimeout, atob, btoa, Float32Array, Uint8Array, Int16Array, DataView,
  });
  const controller = new AbortController();
  const live = await exports.startLiveInterview({ token: "synthetic-token", model: "synthetic-model", expiresAt: new Date(Date.now() + 300000).toISOString(), microphoneStream: stream,
    onCaption: (speaker, text, complete) => captions.push({ speaker, text, complete }), onEnded: (reason) => ended.push(reason),
  }, controller.signal);
  const chunk = (seconds = 1) => ({ inlineData: { mimeType: "audio/pcm;rate=24000", data: Buffer.alloc(24000 * 2 * seconds).toString("base64") } });
  const message = (content) => callbacks.onmessage({ serverContent: content });
  return { live, controller, context, nodes, track, captions, ended, input, worklet, chunk, message,
    permissionRequests: () => permissionRequests, connectionClosed: () => connectionClosed };
}

await check("a burst of 32 seconds of speech keeps every audio chunk in order", async () => {
  const b = await browser();
  try {
    for (let i = 0; i < 32; i++) b.message({ modelTurn: { parts: [b.chunk()] } });
    assert.equal(b.nodes.length, 32); assert.equal(b.nodes.filter(n => n.stopped).length, 0);
    assert.deepEqual(b.nodes.map(n => n.startTime), Array.from({ length: 32 }, (_, i) => i));
    assert.equal(b.ended.length, 0);
  } finally { b.live.stop(); }
});
await check("turn completion preserves queued audio and the final caption", async () => {
  const b = await browser();
  try {
    b.message({ outputTranscription: { text: "What tools did you use?" }, modelTurn: { parts: [b.chunk(2)] } });
    b.message({ turnComplete: true });
    assert.equal(b.nodes[0].stopped, false);
    assert.ok(b.captions.some(c => c.complete && c.text === "What tools did you use?"));
    assert.equal(b.ended.length, 0);
  } finally { b.live.stop(); }
});
await check("a real interruption clears old speech and starts the next reply at the current time", async () => {
  const b = await browser();
  try {
    b.message({ modelTurn: { parts: [b.chunk(2), b.chunk(2)] } });
    b.context.currentTime = 1; b.message({ interrupted: true });
    assert.ok(b.nodes.every(n => n.stopped));
    b.message({ modelTurn: { parts: [b.chunk()] } });
    assert.equal(b.nodes.at(-1).startTime, 1); assert.equal(b.nodes.at(-1).stopped, false);
  } finally { b.live.stop(); }
});
await check("mute disables microphone input without cutting off the interviewer", async () => {
  const b = await browser();
  try {
    b.message({ modelTurn: { parts: [b.chunk()] } });
    b.live.setMuted(true); b.worklet.port.onmessage({ data: new Float32Array(4800) });
    assert.equal(b.track.enabled, false); assert.equal(b.nodes[0].stopped, false);
    assert.equal(b.input.filter(x => x.audio).length, 0);
    assert.equal(b.input.filter(x => x.audioStreamEnd).length, 1);
    b.live.setMuted(false); b.worklet.port.onmessage({ data: new Float32Array(4800) });
    assert.equal(b.track.enabled, true); assert.equal(b.input.filter(x => x.audio).length, 1);
  } finally { b.live.stop(); }
});
await check("stopping closes the microphone, connection and every queued audio node", async () => {
  const b = await browser();
  b.message({ modelTurn: { parts: [b.chunk(), b.chunk()] } }); b.controller.abort();
  assert.equal(b.track.stopped, true); assert.equal(b.context.closed, true); assert.equal(b.connectionClosed(), true);
  assert.ok(b.nodes.every(n => n.stopped)); assert.equal(b.worklet.disconnected, true);
  b.message({ modelTurn: { parts: [b.chunk()] } }); assert.equal(b.nodes.length, 2);
  assert.equal(b.ended.length, 1); assert.equal(b.permissionRequests(), 0);
});
await check("an abnormal two minute playback backlog ends explicitly instead of silently skipping speech", async () => {
  const b = await browser();
  try {
    for (let i = 0; i < 123; i++) b.message({ modelTurn: { parts: [b.chunk()] } });
    assert.equal(b.ended.length, 1); assert.match(b.ended[0], /playback fell too far behind/);
    assert.equal(b.track.stopped, true); assert.ok(b.nodes.every(n => n.stopped));
  } finally { b.live.stop(); }
});
console.log(`${passed} simulated browser playback checks passed. No physical microphone or provider was used.`);
