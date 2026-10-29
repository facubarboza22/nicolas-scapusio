import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ERASE, FIRST_LEAD, HOLD, LAST_HOLD, LEAD, buildTimeline, resolveCue, subtitles } from './lib/timeline.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
const words = (...ws) => ws.map(([text, start, end]) => ({ text, start, end }));

test('a cue is a number or a spoken word, accents and punctuation ignored', () => {
  const w = words(['Primero', 0, 0.4], ['la', 0.4, 0.5], ['multiplicación:', 0.5, 1.2], ['4', 1.3, 1.5], ['por', 1.5, 1.7], ['2,', 1.7, 1.9], ['por', 2.0, 2.2]);
  assert.equal(resolveCue(1.5, w, 0.3), 1.5);
  near(resolveCue('multiplicacion', w, 0.3), 0.8);
  assert.equal(resolveCue('2', w, 0), 1.7);
  assert.equal(resolveCue('por#2', w, 0), 2.0);
  assert.equal(resolveCue(undefined, w, 0), undefined);
  assert.throws(() => resolveCue('suma', w, 0), /not in the narration/);
});

test('subtitles break after punctuation or 4 words', () => {
  const cues = subtitles(words(['¿Cuánto', 0, 0.3], ['da', 0.3, 0.4], ['6', 0.4, 0.6], ['más', 0.6, 0.8], ['4?', 0.8, 1.0], ['¿20', 1.2, 1.4], ['o', 1.4, 1.5], ['14?', 1.5, 1.8]), 10);
  assert.deepEqual(cues.map((c) => c.words.map((w) => w.text).join(' ')), ['¿Cuánto da 6 más', '4?', '¿20 o 14?']);
  assert.equal(cues[0].start, 10);
});

test('the voice sets each scene length; the last one is not erased', () => {
  const reel = { scenes: [{ say: 'a', handAt: 'b' }, { say: 'c', eq: [{ at: 'd', text: '1' }], optionsAt: ['c', 2] }] };
  const clips = [
    { file: 'a.mp3', duration: 2, words: words(['a', 0, 1], ['b', 1, 2]) },
    { file: 'c.mp3', duration: 3, words: words(['c', 0, 1], ['d', 1.5, 3]) },
  ];
  const tl = buildTimeline(reel, clips);
  const end1 = FIRST_LEAD + 2 + HOLD + ERASE;
  near(tl.scenes[0].to, end1);
  near(tl.scenes[0].handAt, FIRST_LEAD + 1);
  near(tl.scenes[1].from, end1);
  near(tl.scenes[1].eq[0].at, LEAD + 1.5);
  assert.deepEqual(tl.scenes[1].optionsAt, [LEAD, 2]);
  assert.equal(tl.scenes[1].erase, 0);
  assert.equal(tl.duration, Math.round((end1 + LEAD + 3 + LAST_HOLD) * 100) / 100);
  near(tl.voice[0].at, FIRST_LEAD);
  near(tl.voice[1].at, end1 + LEAD);
});
