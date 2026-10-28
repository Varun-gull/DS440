// Small pure audio helpers are shared by the browser client and synthetic tests.
export function resamplePcm16(samples: Float32Array, inputRate: number, outputRate = 16000) {
  if (!Number.isFinite(inputRate) || inputRate < outputRate || inputRate > 192000) throw new Error("Unsupported microphone sample rate.");
  const length = Math.floor(samples.length * outputRate / inputRate);
  const output = new Int16Array(length);
  for (let index = 0; index < length; index++) {
    const start = Math.floor(index * inputRate / outputRate);
    const end = Math.max(start + 1, Math.floor((index + 1) * inputRate / outputRate));
    let total = 0;
    for (let source = start; source < Math.min(end, samples.length); source++) total += samples[source];
    const value = Math.max(-1, Math.min(1, total / (end - start)));
    output[index] = value < 0 ? Math.round(value * 32768) : Math.round(value * 32767);
  }
  return output;
}

export function pcm16Bytes(samples: Int16Array) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index++) view.setInt16(index * 2, samples[index], true);
  return bytes;
}

export function pcm16Floats(bytes: Uint8Array) {
  if (bytes.length % 2) throw new Error("Invalid PCM frame.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const output = new Float32Array(bytes.length / 2);
  for (let index = 0; index < output.length; index++) output[index] = view.getInt16(index * 2, true) / 32768;
  return output;
}
