/**
 * Render a draft's slides (or its Reel) from drafts/<post>/slides.json.
 *
 *   node scripts/render.mjs drafts/2026-10-14-bola-de-nieve
 *   node scripts/render.mjs drafts/*            every draft
 *
 * slides.json: { publishAt, note?, caption, slides: [...] } for a carousel, or
 * { publishAt, note?, caption, reel: { duration, scenes: [...], cover: {...} } }.
 * Optional top-level "theme" (salvia, arcilla, bosque): the week's colour scheme;
 * "textSize": "large" for the short 5-slide carousels.
 * Layouts and the look live in scripts/render/slide.html.
 *
 * Writes NN.jpg (1080×1350) or reel.mp4 + cover.jpg (1080×1920) next to it,
 * made to Instagram's specs (scripts/lib/instagram.mjs): the reel is checked
 * with ffprobe after encoding and the render fails if Instagram would refuse it.
 * caption.txt and post.json are written only the first time: after that they
 * belong to the review page, where the approver edits them.
 *
 * A narrated reel gives each scene a "say": the voice (ElevenLabs, see
 * scripts/lib/voice.mjs) sets the timing, the subtitles come from it, and
 * cues like "titleAt": "multiplicación" write things as they're said
 * (scripts/lib/timeline.mjs). Writing, highlighter, ✓ and eraser get sound
 * effects from drafts/_assets/sfx (ElevenLabs sound effects, local only).
 * Optional "voice": an ElevenLabs voice id instead of the default.
 *
 * A reel can carry music: "music": { file, start?, gainDb? }, file relative to
 * the repo (keep tracks in drafts/_assets/music: licensed downloads, not ours
 * to redistribute; only the mixed reel.mp4 gets published).
 *
 * Nicolás's portrait for the last slide is drafts/_assets/retrato.jpg (local
 * only); without it the slide goes out without the photo.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { reelEncodeArgs, reelFileProblems } from './lib/instagram.mjs';
import { buildTimeline } from './lib/timeline.mjs';
import { loadEnv, narrate } from './lib/voice.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = pathToFileURL(join(ROOT, 'scripts', 'render', 'slide.html')).href;
const PORTRAIT = join(ROOT, 'drafts', '_assets', 'retrato.jpg');
const FPS = 30;
/** Frames drawn per video frame and blended together: motion blur, like a real camera. */
const SUBFRAMES = 2;
loadEnv(ROOT);

/** Sound effects per event, and their gain so they sit under the voice. */
const SFX = {
  write: { file: 'escribir.mp3', gainDb: -4 },
  erase: { file: 'borrar.mp3', gainDb: -19 },
  highlight: { file: 'resaltar.mp3', gainDb: 10 },
  tick: { file: 'tilde.mp3', gainDb: 5 },
  ok: { file: 'correcto.mp3', gainDb: -6 },
  wrong: { file: 'error.mp3', gainDb: -12 },
  hit: { file: 'golpe.mp3', gainDb: -8 },
  whoosh: { file: 'whoosh.mp3', gainDb: -14 },
  pop: { file: 'pop.mp3', gainDb: 2 },
};

const dirs = process.argv.slice(2).filter((d) => existsSync(join(d, 'slides.json')));
if (!dirs.length) {
  console.error('Usage: node scripts/render.mjs drafts/<post> [more…]   (each folder needs a slides.json)');
  process.exit(2);
}

const browser = await chromium.launch();
try {
  for (const dir of dirs) await renderPost(resolve(dir));
} finally {
  await browser.close();
}

async function renderPost(dir) {
  const spec = JSON.parse(readFileSync(join(dir, 'slides.json'), 'utf8'));
  if (!existsSync(join(dir, 'caption.txt'))) writeFileSync(join(dir, 'caption.txt'), spec.caption.trim() + '\n');
  if (!existsSync(join(dir, 'post.json'))) writeFileSync(join(dir, 'post.json'), JSON.stringify({ publishAt: spec.publishAt, ...(spec.note ? { note: spec.note } : {}) }, null, 2) + '\n');
  for (const f of readdirSync(dir)) if (/^\d{2}\.jpg$|^reel\.mp4$|^cover\.jpg$/.test(f)) rmSync(join(dir, f));

  if (spec.reel) await renderReel(dir, { theme: spec.theme, ...spec.reel });
  else await renderSlides(dir, spec.slides, spec.theme, spec.textSize);
}

async function newPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  return page;
}

async function renderSlides(dir, slides, theme, textSize) {
  const page = await newPage(1080, 1350);
  const ctx = { theme, textSize, total: slides.length, portrait: existsSync(PORTRAIT) ? pathToFileURL(PORTRAIT).href : null };
  for (const [i, slide] of slides.entries()) {
    await page.evaluate(([s, c]) => window.paint(s, c), [{ ...slide, n: i + 1 }, ctx]);
    await page.screenshot({ path: join(dir, `${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  await page.close();
  console.log(`✓ ${dir.replace(ROOT, '')}: ${slides.length} slides`);
}

async function renderReel(dir, reel) {
  const page = await newPage(1080, 1920);
  if (reel.cover) {
    await page.evaluate((s) => window.reel({ theme: s.theme, bg: s.bg, static: true, scenes: [{ ...s, from: 0, to: 10, last: true }] }), { theme: reel.theme, ...reel.cover });
    await page.evaluate(() => window.seek(1));
    await page.screenshot({ path: join(dir, 'cover.jpg'), type: 'jpeg', quality: 92 });
  }

  let spec = reel;
  let voice = [];
  if (reel.scenes.some((s) => s.say)) {
    const tl = buildTimeline(reel, await narrate(ROOT, reel.scenes, reel.voice));
    spec = { ...reel, scenes: tl.scenes, subs: tl.subs, duration: tl.duration };
    voice = tl.voice;
  }
  const events = (await page.evaluate((r) => window.reel(r), spec)) ?? [];

  // Audio: a silent bed (some players treat a video without audio as broken),
  // the voice clips, every sound effect at its time, and the music if any.
  const sfxDir = join(ROOT, 'drafts', '_assets', 'sfx');
  const tracks = [
    ...voice.map((v) => ({ file: v.file, at: v.at, gainDb: 0 })),
    ...events.filter((e) => SFX[e.type] && existsSync(join(sfxDir, SFX[e.type].file))).map((e) => ({ file: join(sfxDir, SFX[e.type].file), at: e.at, gainDb: SFX[e.type].gainDb, dur: e.dur })),
  ];
  const m = spec.music;
  if (m) tracks.push({ file: join(ROOT, m.file), at: 0, gainDb: m.gainDb ?? 0, seek: m.start ?? 0, dur: spec.duration, fadeIn: 1.5 });
  const inputs = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
  const filters = [];
  tracks.forEach((tr, k) => {
    inputs.push(...(tr.seek ? ['-ss', String(tr.seek)] : []), '-i', tr.file);
    const ms = Math.max(0, Math.round(tr.at * 1000));
    const trim = tr.dur ? `atrim=0:${tr.dur.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=out:st=${Math.max(0, tr.dur - 0.12).toFixed(2)}:d=0.12,` : '';
    const fadeIn = tr.fadeIn ? `afade=t=in:d=${tr.fadeIn},` : '';
    filters.push(`[${k + 2}:a]${trim}${fadeIn}volume=${tr.gainDb}dB,aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[t${k}]`);
  });
  // Screenshots are full-range JPEG; phones expect standard-range video.
  filters.push(`[0:v]tmix=frames=${SUBFRAMES},fps=${FPS},scale=in_range=full:out_range=tv,format=yuv420p[vout]`);
  filters.push(`[1:a]${tracks.map((_, k) => `[t${k}]`).join('')}amix=inputs=${tracks.length + 1}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

  // Frames go straight into ffmpeg.
  const out = join(dir, 'reel.mp4');
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS * SUBFRAMES), '-c:v', 'mjpeg', '-i', '-',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]', '-t', String(spec.duration),
    ...reelEncodeArgs(spec.duration), out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => ff.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`)))));

  const frames = Math.round(spec.duration * FPS * SUBFRAMES);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seek(t), f / (FPS * SUBFRAMES));
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await page.close();
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', out], { encoding: 'utf8' }));
  const problems = reelFileProblems(probe);
  if (problems.length) throw new Error(`reel.mp4 no sirve para Instagram: ${problems.join('; ')}`);
  const mb = (Number(probe.format.size) / 1024 / 1024).toFixed(1);
  console.log(`✓ ${dir.replace(ROOT, '')}: reel ${spec.duration}s, ${mb} MB, ${voice.length} voice clips, ${events.length} sound cues`);
}
