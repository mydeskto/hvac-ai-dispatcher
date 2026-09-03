/**
 * Generates a short synthetic WAV so recording playback works with mock data.
 * Tone pattern is derived from the call id, giving each call a distinct clip.
 */
export function generateWav(callId: string, seconds = 6): Buffer {
  const sampleRate = 8000;
  const samples = sampleRate * seconds;
  const data = Buffer.alloc(samples * 2);
  const seed = Array.from(callId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const segment = Math.floor(t * 2) % 4;
    const freq = 220 + ((seed + segment * 70) % 400);
    const envelope = Math.min(1, Math.sin(Math.PI * (t % 0.5) * 2)) * 0.28;
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * t) * envelope * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}
