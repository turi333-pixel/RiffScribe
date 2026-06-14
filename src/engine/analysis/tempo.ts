/**
 * Tempo estimation from an energy envelope autocorrelation. Rough but real,
 * shared by the mock and on-device engines.
 */
export function estimateTempo(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  // Down-sample to an energy envelope at ~50 Hz.
  const hop = Math.floor(sr / 50);
  const env: number[] = [];
  for (let i = 0; i < data.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < hop && i + j < data.length; j++) sum += Math.abs(data[i + j]);
    env.push(sum / hop);
  }
  const envRate = 50;
  let bestLag = 0;
  let bestCorr = -1;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const lag = Math.round((60 / bpm) * envRate);
    let corr = 0;
    for (let i = 0; i + lag < env.length; i++) corr += env[i] * env[i + lag];
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  const bpm = bestLag > 0 ? Math.round((60 * envRate) / bestLag) : 120;
  return Math.min(180, Math.max(70, bpm));
}

/**
 * Estimate tempo from a list of note onset times via inter-onset-interval
 * histogram. Used when we already have note events and no raw buffer handy.
 */
export function estimateTempoFromOnsets(onsetTimes: number[]): number {
  if (onsetTimes.length < 4) return 120;
  const sorted = [...onsetTimes].sort((a, b) => a - b);
  // Histogram candidate BPMs from pairwise intervals (limited window).
  const votes = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < Math.min(i + 6, sorted.length); j++) {
      const dt = sorted[j] - sorted[i];
      if (dt < 0.15 || dt > 2) continue;
      // Fold into the 70–180 BPM range by doubling/halving.
      let bpm = 60 / dt;
      while (bpm < 70) bpm *= 2;
      while (bpm > 180) bpm /= 2;
      const bucket = Math.round(bpm);
      votes.set(bucket, (votes.get(bucket) ?? 0) + 1);
    }
  }
  let best = 120;
  let bestVotes = 0;
  for (const [bpm, v] of votes) {
    if (v > bestVotes) {
      bestVotes = v;
      best = bpm;
    }
  }
  return best;
}
