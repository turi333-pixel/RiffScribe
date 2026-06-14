/**
 * WaveformViewer — canvas waveform with optional trim handles and a playhead.
 *
 * Used both on the Analyze screen (with draggable trim handles to choose the
 * section to transcribe) and on the transcription screen (read-only with a
 * moving playhead and seek-on-tap).
 */
import { useCallback, useEffect, useRef } from 'react';

interface WaveformViewerProps {
  peaks: number[];
  duration: number;
  height?: number;
  /** Current playhead time in seconds. */
  playhead?: number;
  /** Trim window in seconds. When provided with onTrimChange, handles appear. */
  trim?: { start: number; end: number };
  onTrimChange?: (trim: { start: number; end: number }) => void;
  onSeek?: (time: number) => void;
  /** Highlighted loop region in seconds. */
  loop?: { start: number; end: number } | null;
}

const HANDLE_HIT = 18; // px touch target around a trim handle

export function WaveformViewer({
  peaks,
  duration,
  height = 96,
  playhead,
  trim,
  onTrimChange,
  onSeek,
  loop,
}: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'start' | 'end' | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const mid = height / 2;
    const barW = width / peaks.length;

    const inTrim = (i: number) => {
      if (!trim) return true;
      const t = (i / peaks.length) * duration;
      return t >= trim.start && t <= trim.end;
    };

    // Bars
    peaks.forEach((p, i) => {
      const h = Math.max(1.5, p * (height * 0.92));
      ctx.fillStyle = inTrim(i) ? 'rgba(255,92,43,0.85)' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 1), h);
    });

    // Loop region
    if (loop) {
      ctx.fillStyle = 'rgba(43,214,255,0.14)';
      const x0 = (loop.start / duration) * width;
      const x1 = (loop.end / duration) * width;
      ctx.fillRect(x0, 0, x1 - x0, height);
    }

    // Trim shading + handles
    if (trim) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const sx = (trim.start / duration) * width;
      const ex = (trim.end / duration) * width;
      ctx.fillRect(0, 0, sx, height);
      ctx.fillRect(ex, 0, width - ex, height);
      ctx.strokeStyle = '#ff5c2b';
      ctx.lineWidth = 2;
      [sx, ex].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.fillStyle = '#ff5c2b';
        ctx.fillRect(x - 3, mid - 12, 6, 24);
      });
    }

    // Playhead
    if (playhead !== undefined && duration > 0) {
      const x = (playhead / duration) * width;
      ctx.strokeStyle = '#2bd6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [peaks, duration, height, playhead, trim, loop]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const timeFromEvent = (clientX: number): number => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (trim && onTrimChange) {
      const sx = (trim.start / duration) * rect.width;
      const ex = (trim.end / duration) * rect.width;
      if (Math.abs(x - sx) < HANDLE_HIT) dragRef.current = 'start';
      else if (Math.abs(x - ex) < HANDLE_HIT) dragRef.current = 'end';
    }
    if (dragRef.current) {
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (onSeek) {
      onSeek(timeFromEvent(e.clientX));
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !trim || !onTrimChange) return;
    const t = timeFromEvent(e.clientX);
    if (dragRef.current === 'start') {
      onTrimChange({ start: Math.min(t, trim.end - 0.5), end: trim.end });
    } else {
      onTrimChange({ start: trim.start, end: Math.max(t, trim.start + 0.5) });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full touch-none select-none"
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
