/**
 * TunerGauge — the needle dial. Shows the detected note big in the centre, an
 * arc of cents (−50…+50), a needle that swings to the offset, and turns green
 * when the string is in tune.
 */
import type { TunerReading } from '@/hooks/useTuner';

interface TunerGaugeProps {
  reading: TunerReading;
}

export function TunerGauge({ reading }: TunerGaugeProps) {
  const { active, frequency, noteName, cents, inTune } = reading;
  const hasPitch = active && frequency > 0;

  // Map −50…+50 cents to −45°…+45°.
  const angle = Math.max(-45, Math.min(45, (cents / 50) * 45));
  const near = Math.abs(cents) <= 5;
  const accent = inTune || near ? '#3ddc84' : Math.abs(cents) <= 15 ? '#ffc043' : '#ff5c2b';

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 130" className="w-full max-w-xs">
        {/* Arc */}
        <path d="M20 110 A 80 80 0 0 1 180 110" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
        {/* Tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = (-90 + i * 18) * (Math.PI / 180);
          const r1 = 74;
          const r2 = i === 5 ? 60 : 68;
          const cx = 100 + Math.cos(a - Math.PI / 2) * 0; // placeholder
          void cx;
          const x1 = 100 + Math.sin(a) * r1;
          const y1 = 110 - Math.cos(a) * r1;
          const x2 = 100 + Math.sin(a) * r2;
          const y2 = 110 - Math.cos(a) * r2;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={i === 5 ? '#3ddc84' : 'rgba(255,255,255,0.25)'}
              strokeWidth={i === 5 ? 3 : 1.5}
            />
          );
        })}
        {/* Needle */}
        <g
          style={{
            transform: `rotate(${hasPitch ? angle : 0}deg)`,
            transformOrigin: '100px 110px',
            transition: 'transform 90ms ease-out',
          }}
        >
          <line x1="100" y1="110" x2="100" y2="42" stroke={hasPitch ? accent : 'rgba(255,255,255,0.2)'} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="110" r="6" fill={hasPitch ? accent : 'rgba(255,255,255,0.2)'} />
        </g>
      </svg>

      {/* Readout */}
      <div className="-mt-6 flex flex-col items-center">
        <div
          className="font-display text-6xl font-bold tabular-nums transition-colors"
          style={{ color: hasPitch ? accent : 'rgba(255,255,255,0.25)' }}
        >
          {hasPitch ? noteName.replace(/\d/, '') : '—'}
          <span className="align-top text-2xl text-zinc-500">{hasPitch ? noteName.match(/\d/)?.[0] : ''}</span>
        </div>
        <div className="mt-1 font-mono text-sm tabular-nums text-zinc-400">
          {hasPitch ? (
            <>
              {cents > 0 ? '+' : ''}
              {cents} cents · {frequency.toFixed(1)} Hz
            </>
          ) : active ? (
            'Listening… play a string'
          ) : (
            'Tap start to tune'
          )}
        </div>
        <div
          className={`mt-3 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider transition-all ${
            inTune ? 'bg-signal-green/20 text-signal-green' : 'bg-white/5 text-zinc-500'
          }`}
        >
          {!hasPitch
            ? active
              ? 'Waiting…'
              : 'Idle'
            : inTune
              ? 'In tune ✓'
              : near
                ? 'Almost…'
                : cents < 0
                  ? 'Tune up ↑'
                  : 'Tune down ↓'}
        </div>
      </div>
    </div>
  );
}
