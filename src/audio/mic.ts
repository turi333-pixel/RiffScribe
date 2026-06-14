/**
 * Microphone access helpers shared by the recorder and the tuner.
 *
 * `MicStream` wraps a getUserMedia stream + an AnalyserNode so callers can pull
 * time-domain frames for pitch detection. `Recorder` captures audio to a Blob
 * via MediaRecorder.
 */

let sharedContext: AudioContext | null = null;

/** A lazily-created, shared AudioContext (browsers limit how many you get). */
export function getAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === 'closed') {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    sharedContext = new Ctx();
  }
  if (sharedContext.state === 'suspended') void sharedContext.resume();
  return sharedContext;
}

export interface MicStream {
  stream: MediaStream;
  analyser: AnalyserNode;
  context: AudioContext;
  /** Pull the latest time-domain frame into `out`. */
  read(out: Float32Array): void;
  stop(): void;
}

/** Open the mic and wire up an analyser for live pitch/level reads. */
export async function openMic(fftSize = 2048): Promise<MicStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const context = getAudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  source.connect(analyser);

  return {
    stream,
    analyser,
    context,
    read(out: Float32Array) {
      // Cast: the DOM lib types this as Float32Array<ArrayBuffer> in newer TS.
      analyser.getFloatTimeDomainData(out as Float32Array<ArrayBuffer>);
    },
    stop() {
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** Captures microphone audio to an audio Blob. */
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  startedAt = 0;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250);
    this.startedAt = performance.now();
  }

  get level(): number {
    return 0; // level metering is handled via openMic in the recorder UI
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Recorder not started'));
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

/** Decode a File/Blob into an AudioBuffer for analysis & waveform rendering. */
export async function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const context = getAudioContext();
  return await context.decodeAudioData(arrayBuffer);
}

/**
 * Crop a decoded buffer to [start, end] seconds and encode it as a 16-bit PCM
 * WAV Blob. Used so the analysed/trimmed region becomes the actual playback
 * audio — keeping the tab timeline and the audio on one shared clock.
 */
export function trimToWav(buffer: AudioBuffer, start: number, end: number): Blob {
  const sr = buffer.sampleRate;
  const s = Math.max(0, Math.floor(start * sr));
  const e = Math.min(buffer.length, Math.floor(end * sr));
  const len = Math.max(1, e - s);
  const numCh = buffer.numberOfChannels;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) {
    channels.push(buffer.getChannelData(ch).subarray(s, e));
  }
  return encodeWav(channels, sr, len);
}

/** Return a new AudioBuffer containing only [start, end] seconds of `buffer`. */
export function sliceBuffer(buffer: AudioBuffer, start: number, end: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const s = Math.max(0, Math.floor(start * sr));
  const e = Math.min(buffer.length, Math.floor(end * sr));
  const len = Math.max(1, e - s);
  const ctx = getAudioContext();
  const out = ctx.createBuffer(buffer.numberOfChannels, len, sr);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.copyToChannel(buffer.getChannelData(ch).subarray(s, e), ch);
  }
  return out;
}

function encodeWav(channels: Float32Array[], sampleRate: number, len: number): Blob {
  const numCh = channels.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

/** Reduce an AudioBuffer to N peak amplitudes for waveform rendering. */
export function extractWaveform(buffer: AudioBuffer, samples = 400): number[] {
  const data = buffer.getChannelData(0);
  const block = Math.floor(data.length / samples);
  const peaks: number[] = [];
  for (let i = 0; i < samples; i++) {
    let max = 0;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(data[i * block + j] || 0);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  // Normalise to 0–1.
  const peak = Math.max(...peaks, 0.0001);
  return peaks.map((p) => p / peak);
}
