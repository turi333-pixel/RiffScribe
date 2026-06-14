/**
 * Transport — the playback control bar on the transcription screen.
 * Big primary play/pause, plus slow-down, pitch shift, A/B loop, metronome,
 * count-in and a play-along toggle. Designed for thumbs at the bottom of the
 * screen.
 */
import { Play, Pause, Repeat, Timer, Gauge, Music2, Radio } from 'lucide-react';
import type { Player, PlayerState } from '@/audio/playback';
import { formatTime } from '@/lib/format';

const SPEEDS = [1, 0.75, 0.5, 0.35];

interface TransportProps {
  player: Player;
  state: PlayerState;
  playAlong: boolean;
  onTogglePlayAlong: () => void;
  /** Loop the current section the playhead is in. */
  onToggleLoop: () => void;
  hasLoop: boolean;
  countIn: boolean;
  onToggleCountIn: () => void;
}

function ToolButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: typeof Play;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors ${
        active ? 'bg-ember/20 text-ember' : 'text-zinc-400 hover:bg-white/5'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

export function Transport({
  player,
  state,
  playAlong,
  onTogglePlayAlong,
  onToggleLoop,
  hasLoop,
  countIn,
  onToggleCountIn,
}: TransportProps) {
  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(state.tempo);
    player.setTempo(SPEEDS[(idx + 1) % SPEEDS.length] ?? 1);
  };

  return (
    <div className="border-t border-white/5 bg-ink-900/95 px-4 pb-2 pt-3 backdrop-blur-lg">
      {/* Scrubber */}
      <div className="mb-2 flex items-center gap-2">
        <span className="w-10 text-right font-mono text-[11px] tabular-nums text-zinc-400">
          {formatTime(state.currentTime, true)}
        </span>
        <input
          type="range"
          min={0}
          max={state.duration || 0}
          step={0.01}
          value={state.currentTime}
          onChange={(e) => player.seek(Number(e.target.value))}
          className="h-1.5 flex-1 accent-ember"
        />
        <span className="w-10 font-mono text-[11px] tabular-nums text-zinc-500">
          {formatTime(state.duration)}
        </span>
      </div>

      {/* Primary row */}
      <div className="mb-1 flex items-center justify-center gap-4">
        <button
          onClick={cycleSpeed}
          className="flex w-16 flex-col items-center text-zinc-300"
          aria-label="Playback speed"
        >
          <Gauge size={18} />
          <span className="font-mono text-xs font-semibold text-ember">{state.tempo}×</span>
        </button>

        <button
          onClick={() => player.toggle()}
          className="grid h-16 w-16 place-items-center rounded-full bg-ember text-white shadow-ember active:scale-95"
          aria-label={state.playing ? 'Pause' : 'Play'}
        >
          {state.countingIn ? (
            <span className="font-display text-2xl font-bold">{/* count-in shown elsewhere */}…</span>
          ) : state.playing ? (
            <Pause size={30} fill="currentColor" />
          ) : (
            <Play size={30} fill="currentColor" className="ml-1" />
          )}
        </button>

        <div className="flex w-16 flex-col items-center">
          <span className="font-mono text-[10px] text-zinc-500">pitch</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => player.setSemitones(state.semitones - 1)}
              className="rounded bg-white/5 px-1.5 text-zinc-200"
            >
              −
            </button>
            <span className="w-6 text-center font-mono text-xs font-semibold text-amp-400">
              {state.semitones > 0 ? `+${state.semitones}` : state.semitones}
            </span>
            <button
              onClick={() => player.setSemitones(state.semitones + 1)}
              className="rounded bg-white/5 px-1.5 text-zinc-200"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Tools row */}
      <div className="flex items-stretch gap-1">
        <ToolButton active={playAlong} onClick={onTogglePlayAlong} icon={Radio} label="Play-along" />
        <ToolButton active={hasLoop} onClick={onToggleLoop} icon={Repeat} label="Loop" />
        <ToolButton
          active={state.metronome}
          onClick={() => player.setMetronome(!state.metronome)}
          icon={Music2}
          label="Metronome"
        />
        <ToolButton active={countIn} onClick={onToggleCountIn} icon={Timer} label="Count-in" />
      </div>
    </div>
  );
}
