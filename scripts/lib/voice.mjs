/**
 * Narration for Reels: ElevenLabs text-to-speech with word timings.
 *
 * Each scene's "say" is one request, so a scene lasts exactly as long as its
 * sentence. Results are cached in drafts/_voz/<hash>.mp3 + .json, so a re-render
 * doesn't spend credits; change the text, the voice or the settings and it
 * asks again.
 *
 * Model eleven_v3 takes emotion tags in the text ("[curious] ¿Cuánto da…?",
 * "[excited] ¡14!"): that's where the voice gets its life. Tags are spoken by
 * nobody and never reach the subtitles. v3 has no speed setting, so the clip
 * is sped up afterwards with ffmpeg (TEMPO, pitch kept) and the timings with it.
 *
 * Needs ELEVENLABS_API_KEY in .env (never commit it).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Ignacio: young Uruguayan narrator from the ElevenLabs voice library. */
export const DEFAULT_VOICE = 'AvFwmpNEfWWu5mtNDqhH';
const MODEL = 'eleven_v3';
/** v3 stability: 0 = Creative (most expressive), 0.5 = Natural, 1 = Robust. */
const SETTINGS = { stability: 0 };
const TEMPO = 1.2;

export function loadEnv(root) {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** Words with start/end seconds, from ElevenLabs' per-character alignment. */
export function wordsFromAlignment({ characters, character_start_times_seconds: s, character_end_times_seconds: e }, tempo = 1) {
  const words = [];
  let cur = null;
  let tag = false;
  characters.forEach((ch, i) => {
    if (ch === '[') tag = true;
    if (tag) {
      if (ch === ']') tag = false;
      cur = null;
      return;
    }
    if (/\s/.test(ch)) {
      cur = null;
      return;
    }
    if (!cur) words.push((cur = { text: '', start: s[i] / tempo, end: e[i] / tempo }));
    cur.text += ch;
    cur.end = e[i] / tempo;
  });
  return words;
}

/**
 * One narration clip per scene: [{ file, duration, words }], or null for a
 * scene without "say".
 */
export async function narrate(root, scenes, voice = DEFAULT_VOICE) {
  const dir = join(root, 'drafts', '_voz');
  mkdirSync(dir, { recursive: true });
  const says = scenes.map((s) => s.say ?? null);
  const out = [];
  for (const text of says) {
    if (!text) {
      out.push(null);
      continue;
    }
    const body = {
      text,
      model_id: MODEL,
      voice_settings: SETTINGS,
    };
    const hash = createHash('sha1').update(JSON.stringify([voice, body, TEMPO])).digest('hex').slice(0, 16);
    const mp3 = join(dir, `${hash}.mp3`);
    const meta = join(dir, `${hash}.json`);
    if (!existsSync(mp3) || !existsSync(meta)) {
      if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is missing from .env');
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const raw = join(dir, `${hash}.raw.mp3`);
      writeFileSync(raw, Buffer.from(data.audio_base64, 'base64'));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', `atempo=${TEMPO}`, '-b:a', '160k', mp3]);
      rmSync(raw);
      writeFileSync(meta, JSON.stringify({ text, voice, alignment: data.alignment }, null, 1));
      console.log(`  voz: «${text.slice(0, 50)}…» (${text.length} caracteres)`);
    }
    const { alignment } = JSON.parse(readFileSync(meta, 'utf8'));
    const words = wordsFromAlignment(alignment, TEMPO);
    out.push({ file: mp3, duration: words.at(-1)?.end ?? 0, words });
  }
  return out;
}
