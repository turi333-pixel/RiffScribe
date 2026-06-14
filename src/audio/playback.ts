/**
 * Player — the playback engine behind the transcription screen.
 *
 * Features:
 *  • Slow down without changing pitch (HTMLMediaElement.preservesPitch).
 *  • Independent pitch/key shift via {@link PitchShifter}.
 *  • A/B loop over a time range (e.g. selected bars or a section).
 *  • Metronome synced to BPM, with an optional count-in.
 *  • A `tick` callback (rAF) the UI subscribes to for the playhead.
 */
import { getAudioContext } from './mic';
import { PitchShifter } from './pitchShift';

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  tempo: number; // 1 = normal, 0.5 = half speed
  semitones: number; // pitch shift
  loop: { start: number; end: number } | null;
  metronome: boolean;
  countingIn: boolean;
}

type Listener = (state: PlayerState) => void;

export class Player {
  private audio: HTMLAudioElement;
  private ctx!: AudioContext;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private shifter: PitchShifter | null = null;
  private rafId = 0;
  private listeners = new Set<Listener>();

  private metronomeBpm = 120;
  private countInBeats = 0;
  private countInRemaining = 0;
  private clickTimer = 0;

  // Virtual clock: drives the playhead for projects that have no audio (e.g.
  // the demo) so play-along, looping and the metronome still work.
  private virtual = false;
  private virtualBase = 0; // currentTime when the virtual clock last (re)started
  private virtualStartPerf = 0; // performance.now() at that moment

  state: PlayerState = {
    playing: false,
    currentTime: 0,
    duration: 0,
    tempo: 1,
    semitones: 0,
    loop: null,
    metronome: false,
    countingIn: false,
  };

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.addEventListener('loadedmetadata', () => {
      this.state.duration = this.audio.duration;
      this.emit();
    });
    this.audio.addEventListener('ended', () => {
      this.state.playing = false;
      this.stopLoop();
      this.emit();
    });
  }

  /** Point the player at a source URL (object URL or remote). */
  load(url: string, bpm = 120): void {
    this.virtual = false;
    this.audio.src = url;
    this.metronomeBpm = bpm;
    this.audio.load();
  }

  /**
   * Drive the playhead from a virtual clock instead of audio — used when a
   * project has no audio file (demo / shared links) so play-along still works.
   */
  loadVirtual(duration: number, bpm = 120): void {
    this.virtual = true;
    this.audio.removeAttribute('src');
    this.metronomeBpm = bpm;
    this.state.duration = duration;
    this.state.currentTime = 0;
    this.emit();
  }

  private ensureGraph(): void {
    if (this.sourceNode) return;
    this.ctx = getAudioContext();
    this.sourceNode = this.ctx.createMediaElementSource(this.audio);
    this.shifter = new PitchShifter(this.ctx);
    this.shifter.start();
    this.sourceNode.connect(this.shifter.input);
    this.shifter.output.connect(this.ctx.destination);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l({ ...this.state });
  }

  async play(): Promise<void> {
    // Virtual playback (no audio) must not depend on the AudioContext — only
    // real audio needs the graph resumed under a user gesture.
    if (!this.virtual) {
      this.ensureGraph();
      await this.ctx.resume();
    }
    if (this.countInBeats > 0) {
      this.startCountIn();
      return;
    }
    await this.startPlayback();
  }

  /** Begin actual playback (shared by play() and the count-in completion). */
  private async startPlayback(): Promise<void> {
    if (this.virtual) {
      this.virtualBase = this.state.currentTime;
      this.virtualStartPerf = performance.now();
    } else {
      await this.audio.play();
    }
    this.state.playing = true;
    this.loopTick();
    this.scheduleMetronome();
    this.emit();
  }

  pause(): void {
    if (!this.virtual) this.audio.pause();
    this.state.playing = false;
    this.state.countingIn = false;
    cancelAnimationFrame(this.rafId);
    this.stopMetronome();
    this.emit();
  }

  toggle(): void {
    if (this.state.playing || this.state.countingIn) this.pause();
    else void this.play();
  }

  seek(time: number): void {
    const clamped = Math.max(0, Math.min(time, this.state.duration || time));
    if (this.virtual) {
      this.virtualBase = clamped;
      this.virtualStartPerf = performance.now();
    } else {
      this.audio.currentTime = clamped;
    }
    this.state.currentTime = clamped;
    this.emit();
  }

  /** Set playback tempo while preserving pitch (the "slow down" control). */
  setTempo(tempo: number): void {
    this.state.tempo = tempo;
    this.audio.playbackRate = tempo;
    // preservesPitch keeps the pitch constant as tempo changes.
    (this.audio as any).preservesPitch = true;
    (this.audio as any).mozPreservesPitch = true;
    (this.audio as any).webkitPreservesPitch = true;
    this.emit();
  }

  /** Set pitch/key shift in semitones, independent of tempo. */
  setSemitones(semitones: number): void {
    this.ensureGraph();
    this.state.semitones = semitones;
    this.shifter?.setSemitones(semitones);
    this.emit();
  }

  setLoop(range: { start: number; end: number } | null): void {
    this.state.loop = range;
    if (range && this.state.currentTime < range.start) this.seek(range.start);
    this.emit();
  }

  setMetronome(on: boolean): void {
    this.state.metronome = on;
    if (on && this.state.playing) this.scheduleMetronome();
    else this.stopMetronome();
    this.emit();
  }

  setCountIn(beats: number): void {
    this.countInBeats = beats;
  }

  setBpm(bpm: number): void {
    this.metronomeBpm = bpm;
  }

  // ---- internal loops -----------------------------------------------------

  private loopTick = (): void => {
    if (this.virtual) {
      const elapsed = ((performance.now() - this.virtualStartPerf) / 1000) * this.state.tempo;
      this.state.currentTime = this.virtualBase + elapsed;
      if (this.state.currentTime >= this.state.duration) {
        this.state.currentTime = this.state.duration;
        this.state.playing = false;
        this.stopMetronome();
        this.emit();
        return;
      }
    } else {
      this.state.currentTime = this.audio.currentTime;
    }

    const loop = this.state.loop;
    if (loop && this.state.currentTime >= loop.end) {
      this.seek(loop.start);
    }
    this.emit();
    if (this.state.playing) this.rafId = requestAnimationFrame(this.loopTick);
  };

  private stopLoop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private startCountIn(): void {
    this.state.countingIn = true;
    this.countInRemaining = this.countInBeats;
    this.emit();
    const beatMs = (60 / this.metronomeBpm) * 1000;
    const doBeat = () => {
      if (this.countInRemaining <= 0) {
        this.state.countingIn = false;
        void this.startPlayback();
        return;
      }
      this.click(this.countInRemaining === this.countInBeats);
      this.countInRemaining--;
      this.emit();
      this.clickTimer = window.setTimeout(doBeat, beatMs / this.state.tempo);
    };
    doBeat();
  }

  /** Schedule metronome clicks aligned to the beat grid using Web Audio time. */
  private scheduleMetronome(): void {
    this.stopMetronome();
    if (!this.state.metronome) return;
    const beat = 60 / this.metronomeBpm / this.state.tempo;
    const loop = () => {
      if (!this.state.playing || !this.state.metronome) return;
      const beatsElapsed = this.state.currentTime / (60 / this.metronomeBpm);
      const downbeat = Math.round(beatsElapsed) % 4 === 0;
      this.click(downbeat);
      this.clickTimer = window.setTimeout(loop, beat * 1000);
    };
    loop();
  }

  private stopMetronome(): void {
    if (this.clickTimer) window.clearTimeout(this.clickTimer);
    this.clickTimer = 0;
  }

  /** A short click via an oscillator — accented on the downbeat. */
  private click(accent = false): void {
    this.ensureGraph();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  destroy(): void {
    this.pause();
    this.listeners.clear();
    this.audio.src = '';
  }
}
