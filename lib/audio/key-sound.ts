export type KeySoundKind = "key" | "backspace";

interface AudioBufferPort {
  getChannelData: (channel: number) => Float32Array;
}

interface AudioBufferSourcePort {
  buffer: AudioBufferPort | null;
  connect: (target: unknown) => void;
  start: () => void;
}

interface GainPort {
  gain: { value: number };
  connect: (target: unknown) => void;
}

export interface KeySoundAudioContext {
  state: "suspended" | "running" | "closed";
  sampleRate: number;
  destination: unknown;
  createBuffer: (channels: number, length: number, sampleRate: number) => AudioBufferPort;
  createBufferSource: () => AudioBufferSourcePort;
  createGain: () => GainPort;
  resume: () => Promise<void>;
  close: () => Promise<void>;
}

export type KeySoundAudioContextFactory = () => KeySoundAudioContext;

const OUTPUT_VOLUME = 0.18;

function defaultContextFactory(): KeySoundAudioContext {
  const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Web Audio is not supported in this browser.");
  }
  return new AudioContextConstructor() as unknown as KeySoundAudioContext;
}

function nextNoise(seed: number): { seed: number; value: number } {
  let nextSeed = seed | 0;
  nextSeed ^= nextSeed << 13;
  nextSeed ^= nextSeed >>> 17;
  nextSeed ^= nextSeed << 5;
  return {
    seed: nextSeed,
    value: ((nextSeed >>> 0) / 4_294_967_295) * 2 - 1
  };
}

export function synthesizeKeySound(kind: KeySoundKind, sampleRate: number): Float32Array {
  const durationSeconds = kind === "backspace" ? 0.045 : 0.026;
  const frequency = kind === "backspace" ? 170 : 520;
  const length = Math.max(1, Math.round(sampleRate * durationSeconds));
  const samples = new Float32Array(length);
  let seed = kind === "backspace" ? 0x5f37_59df : 0x13ab_91c7;

  for (let index = 0; index < length; index += 1) {
    const progress = index / length;
    const envelope = Math.pow(1 - progress, kind === "backspace" ? 4 : 7);
    const noise = nextNoise(seed);
    seed = noise.seed;
    const tone = Math.sin(2 * Math.PI * frequency * (index / sampleRate));
    const mixed = kind === "backspace"
      ? tone * 0.55 + noise.value * 0.28
      : tone * 0.24 + noise.value * 0.7;
    samples[index] = Math.max(-1, Math.min(1, mixed * envelope));
  }

  return samples;
}

export class KeySoundPlayer {
  private enabled = false;
  private disposed = false;
  private context: KeySoundAudioContext | null = null;
  private output: GainPort | null = null;
  private buffers: Partial<Record<KeySoundKind, AudioBufferPort>> = {};

  constructor(private readonly contextFactory: KeySoundAudioContextFactory = defaultContextFactory) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(kind: KeySoundKind): void {
    if (!this.enabled || this.disposed) {
      return;
    }

    const context = this.getContext();
    if (!context || context.state === "closed") {
      return;
    }

    if (context.state === "suspended") {
      void context.resume()
        .then(() => this.startSound(context, kind))
        .catch(() => undefined);
      return;
    }

    this.startSound(context, kind);
  }

  dispose(): void {
    this.disposed = true;
    this.buffers = {};
    this.output = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private getContext(): KeySoundAudioContext | null {
    if (this.context) {
      return this.context;
    }

    try {
      const context = this.contextFactory();
      const output = context.createGain();
      output.gain.value = OUTPUT_VOLUME;
      output.connect(context.destination);
      this.context = context;
      this.output = output;
      return context;
    } catch {
      return null;
    }
  }

  private getBuffer(context: KeySoundAudioContext, kind: KeySoundKind): AudioBufferPort {
    const cached = this.buffers[kind];
    if (cached) {
      return cached;
    }

    const samples = synthesizeKeySound(kind, context.sampleRate);
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.getChannelData(0).set(samples);
    this.buffers[kind] = buffer;
    return buffer;
  }

  private startSound(context: KeySoundAudioContext, kind: KeySoundKind): void {
    if (this.disposed || !this.enabled || context.state !== "running" || !this.output) {
      return;
    }

    try {
      const source = context.createBufferSource();
      source.buffer = this.getBuffer(context, kind);
      source.connect(this.output);
      source.start();
    } catch {
      // Audio feedback is optional and must never interrupt typing.
    }
  }
}
