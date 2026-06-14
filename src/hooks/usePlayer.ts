/**
 * usePlayer — provides a singleton {@link Player} instance and subscribes a
 * component to its reactive state. The instance is shared across the app so the
 * mini-player and the transcription screen stay in sync.
 */
import { useEffect, useRef, useState } from 'react';
import { Player, type PlayerState } from '@/audio/playback';

let singleton: Player | null = null;

export function getPlayer(): Player {
  if (!singleton) singleton = new Player();
  return singleton;
}

export function usePlayer() {
  const playerRef = useRef<Player>(getPlayer());
  const [state, setState] = useState<PlayerState>(playerRef.current.state);

  useEffect(() => {
    return playerRef.current.subscribe(setState);
  }, []);

  return { player: playerRef.current, state };
}
