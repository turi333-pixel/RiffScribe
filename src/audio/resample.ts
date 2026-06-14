/**
 * Resample a decoded AudioBuffer to the mono 22.05 kHz Float32 stream that
 * basic-pitch expects, using an OfflineAudioContext (which resamples on render).
 */
const TARGET_RATE = 22050;

export async function resampleTo22050Mono(buffer: AudioBuffer): Promise<Float32Array> {
  const length = Math.ceil(buffer.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, length, TARGET_RATE);

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export const BASIC_PITCH_RATE = TARGET_RATE;
