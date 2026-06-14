# 🎸 RiffScribe

**Hear it. Read it. Play it.** — a mobile-first web app that turns a recorded
riff or an uploaded song into guitar-friendly **chords, tabs, structure, and a
tuner**.

Built with **React + TypeScript + Vite + Tailwind CSS**, using the **Web Audio
API** for recording, playback, waveform rendering, and pitch detection. The
transcription engine is **modular** — an offline mock engine ships by default
and a cloud engine can be dropped in without touching the UI.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview  # preview the production build
```

No backend or API key is required — the app runs fully offline on the
**MockEngine**, and a one-tap **demo song** (“Ember Skyline”) is bundled.

---

## What's implemented

| Area | Highlights |
|------|-----------|
| **Audio input** | Upload (mp3/wav/m4a) · mic recording with live level meter · waveform · **drag-to-trim** |
| **Analysis** | **Real on-device note detection** (Spotify `basic-pitch`, runs in-browser via TensorFlow.js) → actual notes you played → tab + chords (template-matched from detected notes) + key + tempo, all with **confidence scores**. Falls back to an offline mock if detection fails. |
| **Tab display** | Six-string scrollable tab · sticky section headers + chords · timing/beat markers · **play-along** highlight that follows the playhead |
| **Playback** | **Slow down without pitch change** · independent **pitch/key shift** (granular shifter) · A/B section **loop** · **metronome** synced to BPM · **count-in** |
| **Tuner** | Needle gauge · cents readout · standard + Drop D/C, D Standard, Half-step, Open G/D, and **custom** tunings · in-tune detection |
| **Editing** | Tap a chord to change it · edit individual tab notes (string/fret/technique) · change tuning → **regenerate fingering** · per-section notes · **save versions** |
| **Export/share** | PDF · Guitar-Pro-style text · plain-text ASCII tab · **share link** · projects saved in the browser |

---

## Architecture

```
src/
├─ types/             # 📐 Data model (Project, Chord, TabNote, Section, Tuning, …)
├─ data/
│  ├─ tunings.ts      # Tuning presets (standard, drop, open, custom)
│  └─ demoSong.ts     # Bundled "Ember Skyline" demo transcription
├─ engine/            # 🎛️ Pluggable transcription engines
│  ├─ types.ts        #   TranscriptionEngine interface + I/O contracts
│  ├─ fretboard.ts    #   Chord parsing + voicing + melody→tab (tuning-aware)
│  ├─ localEngine.ts  #   ⭐ DEFAULT: real on-device AI (basic-pitch + tfjs)
│  ├─ analysis/       #   chords (template match), tempo, notes→tab, structure
│  ├─ mockEngine.ts   #   Offline deterministic fallback (+ powers the demo)
│  ├─ apiEngine.ts    #   🔌 REAL CLOUD API INTEGRATION POINTS (TODOs)
│  └─ index.ts        #   getEngine() factory — local → mock fallback → cloud
├─ audio/             # 🔊 Web Audio layer
│  ├─ mic.ts          #   getUserMedia, recorder, decode, waveform peaks
│  ├─ pitchDetect.ts  #   McLeod/NSDF monophonic pitch detection (tuner)
│  ├─ pitchShift.ts   #   Granular real-time pitch shifter
│  └─ playback.ts     #   Player: tempo, pitch, loop, metronome, count-in
├─ store/             # Zustand stores (active project + transient capture)
├─ hooks/             # useTuner, usePlayer
├─ lib/               # music theory, formatting, sections, localStorage
├─ components/        # UI: layout, audio, timeline, tab, transport, tuner, edit
├─ screens/           # Home, Analyze, Transcription, Tuner, Library, Shared
├─ export/            # PDF + text/Guitar-Pro exporters
└─ App.tsx            # Hash router + mobile app shell
```

### Data model

The single source of truth is [`src/types/index.ts`](src/types/index.ts). A
`Project` holds metadata (bpm, key, time signature, tuning), the analysis
(`chords`, `tabLines`, `sections`, `bars`), a `confidenceScore`, and saved
`versions`. Everything is plain JSON so a project round-trips cleanly through
`localStorage`, a share link, or a backend.

### Swapping in a real transcription backend 🔌

Everything is stubbed and marked with `TODO(api)` in
[`src/engine/apiEngine.ts`](src/engine/apiEngine.ts). To go live:

1. Implement the backend endpoints (upload → structure → chords → notes → tab).
   Suggested models: **Chordino/BTC** (chords), **madmom** (onsets),
   **CREPE/basic-pitch** (pitch), **Demucs/Spleeter** (separation).
2. Set `VITE_API_BASE_URL` (see [`.env.example`](.env.example)).

`getEngine()` then prefers the cloud engine automatically; the UI is unchanged
because every engine implements the same `TranscriptionEngine` interface.

---

## Notes & limitations

- The default **on-device engine** (`basic-pitch`) does genuine polyphonic note
  detection in the browser. It's accurate on clean single-guitar input (riffs,
  solos, strummed/fingerpicked chords); distorted/electric tones and dense
  passages are harder, and it's not meant for full band mixes (no source
  separation client-side — that's what the cloud engine is for).
- Loading the model is a one-time ~1 MB download (lazy-loaded on first
  analysis); inference uses WebGL and runs in a few seconds on a modern phone.
- Section labels (verse/chorus/solo) are **heuristic guesses**, not true
  structural detection.
- The **MockEngine** remains as an offline fallback and powers the no-audio demo.
- `preservesPitch` (slow-down) and the granular pitch shifter are browser-based
  and tuned for practice, not studio fidelity.
- Local audio is persisted as a base64 data URL; very large files may exceed the
  `localStorage` quota (a real deployment should use IndexedDB / the backend).
```
