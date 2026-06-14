/**
 * Real-time pitch shifter, independent of tempo — the well-known "Jungle"
 * two-delay-line crossfade algorithm (after Chris Wilson's implementation).
 *
 * Two delay lines have their delay times swept by looping buffers; a matching
 * pair of fade buffers crossfades between them across the seams so the result
 * is continuous. Good enough for ±a few semitones of practice transposition
 * with no backend or AudioWorklet. The {@link Player} only depends on
 * `input` / `output`.
 */
const FADE_TIME = 0.05;
const BUFFER_TIME = 0.1;

/** Equal-power fade envelope used to crossfade the two delay lines. */
function createFadeBuffer(ctx: AudioContext, activeTime: number, fadeTime: number): AudioBuffer {
  const length1 = activeTime * ctx.sampleRate;
  const length2 = (activeTime - 2 * fadeTime) * ctx.sampleRate;
  const length = length1 + length2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);
  const fadeLength = fadeTime * ctx.sampleRate;
  const fadeIndex1 = fadeLength;
  const fadeIndex2 = length1 - fadeLength;
  for (let i = 0; i < length1; ++i) {
    let value: number;
    if (i < fadeIndex1) value = Math.sqrt(i / fadeLength);
    else if (i >= fadeIndex2) value = Math.sqrt(1 - (i - fadeIndex2) / fadeLength);
    else value = 1;
    p[i] = value;
  }
  for (let i = length1; i < length; ++i) p[i] = 0;
  return buffer;
}

/** Sawtooth-ish ramp that drives a delay line's delayTime (up or down). */
function createDelayTimeBuffer(
  ctx: AudioContext,
  activeTime: number,
  fadeTime: number,
  shiftUp: boolean,
): AudioBuffer {
  const length1 = activeTime * ctx.sampleRate;
  const length2 = (activeTime - 2 * fadeTime) * ctx.sampleRate;
  const length = length1 + length2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);
  for (let i = 0; i < length1; ++i) {
    p[i] = shiftUp ? (length1 - i) / length : i / length1;
  }
  for (let i = length1; i < length; ++i) p[i] = 0;
  return buffer;
}

export class PitchShifter {
  readonly input: GainNode;
  readonly output: GainNode;

  private ctx: AudioContext;
  private mod1Gain: GainNode;
  private mod2Gain: GainNode;
  private mod3Gain: GainNode;
  private mod4Gain: GainNode;
  private modGain1: GainNode;
  private modGain2: GainNode;
  private mod1: AudioBufferSourceNode;
  private mod2: AudioBufferSourceNode;
  private mod3: AudioBufferSourceNode;
  private mod4: AudioBufferSourceNode;
  private fade1: AudioBufferSourceNode;
  private fade2: AudioBufferSourceNode;
  private started = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    const shiftDown = createDelayTimeBuffer(ctx, BUFFER_TIME, FADE_TIME, false);
    const shiftUp = createDelayTimeBuffer(ctx, BUFFER_TIME, FADE_TIME, true);

    this.mod1 = ctx.createBufferSource();
    this.mod2 = ctx.createBufferSource();
    this.mod3 = ctx.createBufferSource();
    this.mod4 = ctx.createBufferSource();
    this.mod1.buffer = shiftDown;
    this.mod2.buffer = shiftDown;
    this.mod3.buffer = shiftUp;
    this.mod4.buffer = shiftUp;
    [this.mod1, this.mod2, this.mod3, this.mod4].forEach((m) => (m.loop = true));

    // Gates selecting shift-up vs shift-down ramps.
    this.mod1Gain = ctx.createGain();
    this.mod2Gain = ctx.createGain();
    this.mod3Gain = ctx.createGain();
    this.mod4Gain = ctx.createGain();
    this.mod3Gain.gain.value = 0;
    this.mod4Gain.gain.value = 0;

    this.mod1.connect(this.mod1Gain);
    this.mod2.connect(this.mod2Gain);
    this.mod3.connect(this.mod3Gain);
    this.mod4.connect(this.mod4Gain);

    // Amount of delay sweep (= pitch shift depth).
    this.modGain1 = ctx.createGain();
    this.modGain2 = ctx.createGain();
    const delay1 = ctx.createDelay();
    const delay2 = ctx.createDelay();
    this.mod1Gain.connect(this.modGain1);
    this.mod2Gain.connect(this.modGain2);
    this.mod3Gain.connect(this.modGain1);
    this.mod4Gain.connect(this.modGain2);
    this.modGain1.connect(delay1.delayTime);
    this.modGain2.connect(delay2.delayTime);

    // Crossfade between the two delay lines.
    const mix1 = ctx.createGain();
    const mix2 = ctx.createGain();
    mix1.gain.value = 0;
    mix2.gain.value = 0;
    const fadeBuffer = createFadeBuffer(ctx, BUFFER_TIME, FADE_TIME);
    this.fade1 = ctx.createBufferSource();
    this.fade2 = ctx.createBufferSource();
    this.fade1.buffer = fadeBuffer;
    this.fade2.buffer = fadeBuffer;
    this.fade1.loop = true;
    this.fade2.loop = true;
    this.fade1.connect(mix1.gain);
    this.fade2.connect(mix2.gain);

    // Audio graph.
    this.input.connect(delay1);
    this.input.connect(delay2);
    delay1.connect(mix1);
    delay2.connect(mix2);
    mix1.connect(this.output);
    mix2.connect(this.output);

    this.setSemitones(0); // start transparent
  }

  private setDelay(t: number): void {
    this.modGain1.gain.setTargetAtTime(0.5 * t, this.ctx.currentTime, 0.01);
    this.modGain2.gain.setTargetAtTime(0.5 * t, this.ctx.currentTime, 0.01);
  }

  /**
   * Set the pitch shift in semitones (negative = down, 0 = transparent).
   *
   * The delay sweep rate maps directly to the pitch ratio: a delay ramping by
   * `0.5·t` over the `BUFFER_TIME` window changes pitch by `±5·t`. So to hit an
   * exact equal-tempered ratio r = 2^(s/12) we solve t = |r − 1| / 5. This makes
   * the labelled semitones match the real shift (the old s/12 mapping made +12
   * sound like only a fifth).
   */
  setSemitones(semitones: number): void {
    const ratio = Math.pow(2, semitones / 12);
    if (semitones >= 0) {
      // Shift up: use the descending-delay ramps.
      this.mod1Gain.gain.value = 0;
      this.mod2Gain.gain.value = 0;
      this.mod3Gain.gain.value = 1;
      this.mod4Gain.gain.value = 1;
      this.setDelay((ratio - 1) / 5);
    } else {
      // Shift down: ascending-delay ramps.
      this.mod1Gain.gain.value = 1;
      this.mod2Gain.gain.value = 1;
      this.mod3Gain.gain.value = 0;
      this.mod4Gain.gain.value = 0;
      this.setDelay((1 - ratio) / 5);
    }
  }

  start(): void {
    if (this.started) return;
    const t = this.ctx.currentTime + 0.05;
    const t2 = t + BUFFER_TIME - FADE_TIME;
    this.mod1.start(t);
    this.mod2.start(t2);
    this.mod3.start(t);
    this.mod4.start(t2);
    this.fade1.start(t);
    this.fade2.start(t2);
    this.started = true;
  }
}
