/**
 * Turns a narrated reel (scenes with "say") into absolute times: when each
 * scene starts and ends, when the voice clips play, the subtitle cues, and
 * every "…At" cue resolved to seconds. Pure: the tests use it as is.
 *
 * A cue is a number (seconds after the scene starts) or a word the narrator
 * says in that scene ("multiplicación", "8", "por#2" for the second "por"):
 * the thing is written when the word is spoken.
 *
 * Scene clock: from ── lead ── voice ── hold ── erase ──▶ to (= next from).
 * The last scene isn't erased; it holds a little longer.
 */
export const LEAD = 0.25;
export const FIRST_LEAD = 0.15;
export const HOLD = 0.35;
export const ERASE = 0.75;
export const LAST_HOLD = 2;

const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');

/** Seconds (from the scene start) for a cue, or undefined when there is none. */
export function resolveCue(cue, words, voiceOffset) {
  if (cue === undefined || cue === null) return undefined;
  if (typeof cue === 'number') return cue;
  const [word, nth = '1'] = String(cue).split('#');
  const hits = words.filter((w) => norm(w.text) === norm(word));
  const hit = hits[Number(nth) - 1];
  if (!hit) throw new Error(`cue «${cue}» is not in the narration: ${words.map((w) => w.text).join(' ')}`);
  return voiceOffset + hit.start;
}

/** Subtitle cues: up to 4 words, breaking after punctuation. */
export function subtitles(words, offset) {
  const chunks = [];
  let cur = [];
  for (const w of words) {
    cur.push({ text: w.text, start: offset + w.start, end: offset + w.end });
    if (cur.length >= 4 || /[.,;:?!]$/.test(w.text)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks.map((ws, i) => ({ start: ws[0].start, end: ws.at(-1).end + 0.25, words: ws, i }));
}

export function buildTimeline(reel, clips) {
  const scenes = [];
  const voice = [];
  const subs = [];
  let t = 0;
  reel.scenes.forEach((s, i) => {
    const clip = clips[i];
    const last = i === reel.scenes.length - 1;
    const lead = s.lead ?? (i === 0 ? FIRST_LEAD : LEAD);
    const from = t;
    const talk = clip ? clip.duration : s.duration ?? 3;
    const to = from + lead + talk + (last ? s.hold ?? LAST_HOLD : (s.hold ?? HOLD) + ERASE);
    const words = clip?.words ?? [];
    const cue = (c) => resolveCue(c, words, lead);
    const scene = { ...s, from, to, last, erase: last ? 0 : ERASE };
    for (const k of ['kickerAt', 'titleAt', 'bodyAt', 'handAt', 'signAt']) if (k in s) scene[k] = cue(s[k]);
    if (s.stepsAt) scene.stepsAt = s.stepsAt.map(cue);
    if (s.optionsAt) scene.optionsAt = s.optionsAt.map(cue);
    if (s.eq) scene.eq = s.eq.map((l) => ({ ...l, at: cue(l.at), noteAt: cue(l.noteAt), hlAt: cue(l.hlAt), markAt: cue(l.markAt) }));
    scenes.push(scene);
    if (clip) {
      voice.push({ file: clip.file, at: from + lead });
      subs.push(...subtitles(words, from + lead));
    }
    t = to;
  });
  subs.forEach((c, i) => {
    // A cue stays until the next one starts, unless there's a real pause.
    const next = subs[i + 1];
    if (next && next.start - c.end < 0.6) c.end = next.start;
  });
  return { duration: Math.round(t * 100) / 100, scenes, voice, subs };
}
