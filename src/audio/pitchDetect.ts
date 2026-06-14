/**
 * Monophonic pitch detection via the McLeod/normalised-autocorrelation method.
 * Robust enough for a guitar tuner and far less octave-error-prone than naive
 * autocorrelation. Operates on a single Float32Array window of time-domain
 * samples (e.g. from `AnalyserNode.getFloatTimeDomainData`).
 */

export interface PitchReading {
  /** Detected fundamental frequency in Hz, or -1 if no clear pitch. */
  frequency: number;
  /** 0–1 estimate of how periodic/clean the signal is. */
  clarity: number;
}

const MIN_CLARITY = 0.9; // peak clarity threshold for accepting a pitch
const MIN_RMS = 0.01; // ignore near-silence

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchReading {
  const size = buffer.length;

  // Reject quiet input quickly.
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < MIN_RMS) return { frequency: -1, clarity: 0 };

  // Normalised square difference function (NSDF).
  const nsdf = new Float32Array(size);
  for (let tau = 0; tau < size; tau++) {
    let acf = 0; // autocorrelation
    let div = 0; // normalisation
    for (let i = 0; i < size - tau; i++) {
      acf += buffer[i] * buffer[i + tau];
      div += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
    }
    nsdf[tau] = div > 0 ? (2 * acf) / div : 0;
  }

  // Find the first positive zero crossing, then collect peaks after it.
  let tau = 0;
  while (tau < size - 1 && nsdf[tau] > 0) tau++; // skip the initial lobe
  let bestTau = -1;
  let bestVal = 0;
  for (; tau < size - 1; tau++) {
    if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) {
      // local maximum
      if (nsdf[tau] > bestVal) {
        bestVal = nsdf[tau];
        bestTau = tau;
      }
    }
  }

  if (bestTau <= 0 || bestVal < MIN_CLARITY) {
    return { frequency: -1, clarity: bestVal };
  }

  // Parabolic interpolation around the peak for sub-sample accuracy.
  const x0 = bestTau - 1;
  const x2 = bestTau + 1;
  const a = nsdf[x0];
  const b = nsdf[bestTau];
  const c = nsdf[x2];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const period = bestTau + shift;

  return { frequency: sampleRate / period, clarity: bestVal };
}
