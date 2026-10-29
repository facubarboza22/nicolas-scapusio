/*
 * The Reel engine, loaded by slide.html (it uses md, esc, paras, handCircle,
 * logo, HANDLE and SIGN from there).
 *
 *   window.reel(spec)  lays every scene out once and returns the sound events
 *   window.seek(t)     draws the frame at t seconds (call it with t growing)
 *
 * spec comes from scripts/lib/timeline.mjs: absolute from/to per scene and
 * every cue already in seconds after the scene starts.
 *
 * The look is a macro shot of a notebook on a desk: a virtual camera that
 * pushes in on whatever is being written, a pen that writes it, soft light,
 * depth of field and film grain. What Nico writes (kicker, eq lines and their
 * notes, hand notes, ✓ ✗, the signature) is drawn letter by letter under the
 * pen; printed text (title, body, steps, options) springs in word by word.
 * Between scenes a board eraser wipes the page.
 *
 * Scene fields: kicker, title, body, steps, eq, options, hand, sign, each with
 * an optional cue: kickerAt, titleAt, bodyAt, stepsAt[], optionsAt[], handAt,
 * signAt; eq lines take at, noteAt, hlAt (highlighter, [..]) and markAt
 * ("mark": "ok" | "bad"). Without a cue, things follow each other. A negative
 * cue means "already written" (the hook on the first frame). ~..~ is a red
 * cross-out. options: [{ "label": "A", "text": "32" }, …].
 */
(() => {
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  /** Underdamped spring from 0 to 1: a little overshoot, settled in ~0.5 s. */
  const spring = (u, w = 16, z = 0.55) => {
    if (u <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + ((z * w) / wd) * Math.sin(wd * u));
  };
  const WRITE_CPS = 15;
  const EQ_CPS = 9;
  const POP_GAP = 0.07;
  const ERASE_W = 300;
  const W = 1080;
  const H = 1920;
  /** Screen band for content: under the logo, over the subtitles. */
  const TOP = 260;
  const BOTTOM = 1330;

  let R;

  function sceneHtml(s, i) {
    const eq = s.eq ? `<div class="eq">${s.eq.map((l, j) => `
        <div class="eqline" data-item="eq" data-j="${j}" style="font-size:${s.eqSize ?? 136}px">${md(l.text)}${l.mark ? `<span class="mark ${l.mark}" data-item="mark" data-j="${j}">${l.mark === 'ok' ? '✓' : '✗'}</span>` : ''}</div>
        ${l.note ? `<div class="eqnote" data-item="note" data-j="${j}">↑ ${md(l.note)}</div>` : ''}`).join('')}</div>` : '';
    const options = s.options ? `<div class="options">${s.options.map((o, j) => `
        <div class="option" data-item="option" data-j="${j}"><span class="letter">${esc(o.label)}</span><span class="val">${md(o.text)}</span></div>`).join('')}</div>` : '';
    return `<div class="scene" data-i="${i}" style="justify-content:${s.align ?? 'center'}">
        ${s.kicker ? `<div><span class="kicker" data-item="kicker"><span class="hl">${esc(s.kicker)}</span></span></div>` : ''}
        ${s.title ? `<h1 data-item="title" style="font-size:${s.size ?? 104}px">${md(s.title)}</h1>` : ''}
        ${s.body ? `<div class="body" data-item="body" style="font-size:54px;margin-top:44px">${paras(s.body)}</div>` : ''}
        ${s.steps ? `<ol class="steps">${s.steps.map((x, j) => `<li data-item="step" data-j="${j}"><span class="ring">${handCircle(48, { seed: i * 9 + j, width: 4, passes: 1 })}</span>${md(x)}</li>`).join('')}</ol>` : ''}
        ${eq}
        ${options}
        ${s.hand ? `<div class="hand" data-item="hand" style="margin-top:56px;font-size:${s.handSize ?? 80}px">${md(s.hand)}</div>` : ''}
        ${s.sign ? `<div class="sign" data-item="sign" style="font-size:150px">${SIGN}</div><div data-item="handle" style="margin-top:44px;font:700 46px/1 'Atkinson Hyperlegible',sans-serif">${HANDLE}</div>` : ''}
      </div>`;
  }

  /** Wrap every character (pen) or word (print) of el's text in its own span. */
  function split(el, unit) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (n.parentElement.closest('svg') || n.parentElement.matches('.c, .wd')) continue;
      const frag = document.createDocumentFragment();
      const parts = unit === 'char' ? [...n.textContent] : n.textContent.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (unit === 'word' && /^\s+$/.test(p)) {
          frag.append(p);
          continue;
        }
        const sp = document.createElement('span');
        sp.className = unit === 'char' ? 'c' : 'wd';
        sp.textContent = p;
        frag.append(sp);
      }
      n.replaceWith(frag);
    }
    return [...el.querySelectorAll(unit === 'char' ? '.c' : '.wd')].filter((x) => !x.closest('[data-item="mark"]') || el.dataset.item === 'mark');
  }

  /** Bounding box of an element in sheet coordinates (camera at rest). */
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  /** Start and duration of everything in one scene, in order. */
  function schedule(sceneEl, s) {
    const items = [];
    let cursor = 0;
    const add = (el, kind, cue, cps) => {
      const start = cue ?? cursor;
      const units = split(el, kind === 'pop' ? 'word' : 'char');
      let t = 0;
      const timed = units.map((u) => {
        const at = t;
        t += kind === 'pop' ? POP_GAP : /\s/.test(u.textContent) ? 0.3 / cps : 1 / cps;
        return { el: u, at, box: null };
      });
      const dur = kind === 'pop' ? t + 0.3 : t;
      const item = { el, kind, start: start < 0 ? -99 : start, dur, units: timed, scene: s, type: el.dataset.item };
      items.push(item);
      cursor = Math.max(cursor, (start < 0 ? 0 : start) + dur);
      return item;
    };
    const q = (sel) => sceneEl.querySelector(sel);
    if (q('[data-item="kicker"]')) add(q('[data-item="kicker"]'), 'write', s.kickerAt, WRITE_CPS);
    if (q('[data-item="title"]')) add(q('[data-item="title"]'), 'pop', s.titleAt);
    if (q('[data-item="body"]')) add(q('[data-item="body"]'), 'pop', s.bodyAt);
    sceneEl.querySelectorAll('[data-item="step"]').forEach((el, j) => add(el, 'pop', s.stepsAt?.[j]));
    (s.eq ?? []).forEach((l, j) => {
      const line = add(q(`[data-item="eq"][data-j="${j}"]`), 'write', l.at, EQ_CPS);
      const lineEnd = line.start + line.dur;
      if (line.el.querySelector('.hl, .x')) items.push({ el: line.el, kind: 'hl', start: l.hlAt ?? lineEnd + 0.15, dur: 0.6, scene: s, units: [] });
      const note = q(`[data-item="note"][data-j="${j}"]`);
      if (note) add(note, 'write', l.noteAt ?? lineEnd + 0.2, WRITE_CPS);
      const mark = q(`[data-item="mark"][data-j="${j}"]`);
      if (mark) {
        const m = add(mark, 'write', l.markAt ?? lineEnd + 0.15, 4);
        m.mark = l.mark;
        m.line = line;
      }
    });
    sceneEl.querySelectorAll('[data-item="option"]').forEach((el, j) => {
      const it = add(el, 'pop', s.optionsAt?.[j]);
      it.card = j;
    });
    if (q('[data-item="hand"]')) add(q('[data-item="hand"]'), 'write', s.handAt, WRITE_CPS);
    if (q('[data-item="sign"]')) {
      add(q('[data-item="sign"]'), 'write', s.signAt, 6);
      add(q('[data-item="handle"]'), 'pop');
    }
    return items;
  }

  /** Zigzag rows over the scene's content: the eraser's path. */
  function eraserPath(b) {
    const x0 = Math.max(60, b.x - 40);
    const x1 = Math.min(1020, b.x + b.w + 60);
    const rows = Math.max(2, Math.ceil(b.h / 210) + 1);
    const pts = [];
    for (let k = 0; k < rows; k++) {
      const y = b.y + 40 + ((b.h - 80) * k) / (rows - 1);
      pts.push(k % 2 ? [x1, y] : [x0, y], k % 2 ? [x0, y + 30] : [x1, y + 30]);
    }
    let len = 0;
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push((len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])));
    return { pts, cum, len };
  }
  function pathUpTo({ pts, cum, len }, p) {
    const d = p * len;
    const out = [pts[0]];
    for (let k = 1; k < pts.length; k++) {
      if (cum[k] <= d) out.push(pts[k]);
      else {
        const u = (d - cum[k - 1]) / (cum[k] - cum[k - 1]);
        out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]);
        break;
      }
    }
    return out;
  }
  const svgPath = (pts) => 'M' + pts.map((q) => q.map((v) => v.toFixed(0)).join(' ')).join(' L');

  /* ---------- the camera and the pen: springs integrated frame by frame ---------- */

  /** Camera targets over time: { at, cx, cy, z, w } (w = spring stiffness). */
  function cameraPlan(scenes) {
    // Each scene is framed close: its content fills most of the width and sits
    // between the logo (TOP) and the subtitles (BOTTOM).
    const frame = (b, z) => ({ cx: b.cx, cy: b.cy + (H / 2 - (TOP + BOTTOM) / 2) / z, z });
    const fit = (b) => clamp(Math.min((0.84 * W) / b.w, (0.92 * (BOTTOM - TOP)) / b.h), 1.08, 1.6);
    /** Pan no further than keeps the whole content on screen. */
    const inView = (k, b) => {
      const lim = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : clamp(v, lo, hi));
      return { ...k, cx: lim(k.cx, b.x + b.w - (W / 2 - 50) / k.z, b.x + (W / 2 - 50) / k.z), cy: lim(k.cy, b.y + b.h - (BOTTOM - H / 2) / k.z, b.y + (H / 2 - TOP) / k.z) };
    };
    const first = frame(scenes[0]._box, scenes[0].zoom ?? fit(scenes[0]._box));
    const keys = [{ at: -1, ...first, z: first.z * 0.86, w: 10 }];
    scenes.forEach((s, i) => {
      const b = s._box;
      const base = frame(b, s.zoom ?? fit(b));
      keys.push({ at: s.from + (i === 0 ? 0.05 : 0), ...base, w: i === 0 ? 7 : 5 });
      for (const it of s._items) {
        if (it.start < 0 || it.kind === 'hl' || it.type === 'handle') continue;
        const ib = box(it.el);
        const focus = it.type === 'eq' || it.mark ? 0.4 : it.kind === 'write' ? 0.3 : 0.2;
        const z = base.z * (it.mark === 'ok' ? 1.1 : it.type === 'eq' ? 1.05 : 1.025);
        keys.push(inView({ at: s.from + it.start, cx: base.cx + (ib.cx - b.cx) * focus, cy: base.cy + (ib.cy - b.cy) * focus, z, w: it.mark === 'ok' ? 11 : 4.5 }, b));
        if (it.mark === 'ok') keys.push({ at: s.from + it.start + 0.9, ...base, w: 4 });
      }
      if (s.erase) keys.push({ at: s.to - s.erase, ...base, z: base.z * 0.97, w: 6 });
      if (s.last) keys.push({ at: s.to - 1.6, ...base, z: base.z * 0.86, w: 3 });
    });
    return keys.sort((a, b) => a.at - b.at);
  }

  /** Keep the sheet covering the screen (except when we pull back on purpose). */
  function clampCam(c) {
    if (c.z < 1.05) return c;
    // A little extra so the tilted sheet never shows its corners.
    const hw = W / 2 / c.z + 22;
    const hh = H / 2 / c.z + 22;
    return { ...c, cx: clamp(c.cx, hw, W - hw), cy: clamp(c.cy, hh, H - hh) };
  }

  /** Critically damped follower, stepped at 240 Hz. */
  function follower(init) {
    const st = { t: -1, v: { ...init }, d: Object.fromEntries(Object.keys(init).map((k) => [k, 0])) };
    return (t, targetAt, wAt) => {
      if (t < st.t) {
        st.t = -1;
        st.v = { ...init };
        for (const k in st.d) st.d[k] = 0;
      }
      const dt = 1 / 240;
      while (st.t < t) {
        const target = targetAt(st.t);
        const w = wAt(st.t);
        for (const k in st.v) {
          const a = w * w * (target[k] - st.v[k]) - 2 * w * st.d[k];
          st.d[k] += a * dt;
          st.v[k] += st.d[k] * dt;
        }
        st.t += dt;
      }
      return st.v;
    };
  }

  /** Where the pen tip should be at t, or its parking spot when nothing is being written. */
  function penTarget(t) {
    const PARK = { x: 1180, y: 2050 };
    let best = null;
    for (const it of R.writes) {
      const a = it.scene.from + it.start;
      const b = a + it.dur;
      if (t >= a && t <= b) {
        const local = t - a;
        let u = it.units[0];
        for (const x of it.units) if (x.at <= local) u = x;
        const k = clamp((local - u.at) * (it.type === 'eq' ? EQ_CPS : WRITE_CPS));
        const bx = u.box;
        const wob = Math.sin(t * 38) * bx.h * 0.08;
        return { x: bx.x + bx.w * k, y: bx.y + bx.h * 0.72 + wob, lift: 0 };
      }
      // Hover near the next thing to write if it's coming soon, or stay where we finished.
      if (t < a && a - t < 0.45 && (!best || a < best.a)) best = { a, x: it.units[0].box.x, y: it.units[0].box.y + it.units[0].box.h * 0.72, lift: 1 };
      if (t > b && t - b < 0.35 && !best) best = { a: b, x: it.units.at(-1).box.x + it.units.at(-1).box.w, y: it.units.at(-1).box.y + it.units.at(-1).box.h * 0.72, lift: 1 };
    }
    return best ? { x: best.x, y: best.y - 20, lift: best.lift } : { ...PARK, lift: 1 };
  }

  /* ---------- particles: deterministic bursts ---------- */

  function rngf(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
  }
  function burst(x, y, at, seed) {
    const r = rngf(seed);
    const colors = ['var(--marker)', 'var(--pen)', 'var(--red)', '#1f9d55'];
    return Array.from({ length: 26 }, (_, k) => {
      const a = r() * Math.PI * 2;
      const v = 500 + r() * 700;
      return { x, y, at, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 350, spin: (r() - 0.5) * 900, size: 12 + r() * 16, color: colors[k % 4], shape: k % 3, life: 0.9 + r() * 0.5 };
    });
  }

  /* ---------- layout ---------- */

  window.reel = async (spec) => {
    document.body.classList.add('reel');
    document.body.dataset.theme = spec.theme ?? 'mate';
    const root = document.getElementById('root');
    root.innerHTML = `
      <section class="stage">
        <div class="desk"></div>
        <div class="cam">
          <div class="sheet slide ${spec.bg ? bgClass(spec.bg) : ''}">${grain(7)}
            ${spec.scenes.map(sceneHtml).join('')}
            <svg class="dust" width="${W}" height="${H}">${[-110, -60, -15, 35, 80, 120].map((o, k) => `<path fill="none" stroke="rgba(28,42,74,${k % 2 ? 0.07 : 0.045})" stroke-width="${8 + (k % 3) * 5}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${k * 3 - 6} ${o})"/>`).join('')}</svg>
            <div class="confetti"></div>
            <div class="eraser"><div class="wood"></div><div class="felt"></div></div>
            <div class="pen">${PEN}</div>
          </div>
        </div>
        <div class="light"></div>
        <div class="dof"></div>
        <svg class="film" width="${W}" height="${H}"><filter id="fg"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="1"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .9 0"/></filter><rect width="100%" height="100%" filter="url(#fg)"/></svg>
        <div class="reel-logo">${logo()}</div>
        <div id="subs"></div>
      </section>`;
    await document.fonts.ready;

    R = { scenes: spec.scenes, subs: spec.subs ?? [], items: [], writes: [], particles: [], static: !!spec.static, paths: [] };
    const events = [];
    document.querySelectorAll('.scene').forEach((el, i) => {
      const s = spec.scenes[i];
      el.style.visibility = 'visible';
      const items = schedule(el, s);
      for (const it of items) for (const u of it.units) u.box = box(u.el);
      // What's actually inked: letters, words, cards and rings (blocks span the whole column).
      const content = [...items.flatMap((it) => it.units.map((u) => u.box)), ...[...el.querySelectorAll('.option, .ring')].map(box)].filter((b) => b.w);
      const b = { x: Math.min(...content.map((c) => c.x)), y: Math.min(...content.map((c) => c.y)) };
      b.w = Math.max(...content.map((c) => c.x + c.w)) - b.x;
      b.h = Math.max(...content.map((c) => c.y + c.h)) - b.y;
      b.cx = b.x + b.w / 2;
      b.cy = b.y + b.h / 2;
      s._box = b;
      s._items = items;
      R.paths[i] = s.erase ? eraserPath(b) : null;
      for (const it of items) {
        R.items.push(it);
        const at = s.from + it.start;
        if (it.kind === 'write' && it.units.length) R.writes.push(it);
        if (it.start < 0) continue;
        if (it.kind === 'write' && !it.mark) events.push({ type: 'write', at, dur: it.dur });
        if (it.kind === 'hl') events.push({ type: 'highlight', at });
        if (it.card !== undefined) events.push({ type: 'pop', at });
        if (it.mark === 'ok') {
          const lb = box(it.line.el);
          R.particles.push(...burst(lb.x + lb.w + 60, lb.cy, at + 0.2, 99 + i));
          events.push({ type: 'tick', at }, { type: 'ok', at: at + 0.15 });
        }
        if (it.mark === 'bad') events.push({ type: 'tick', at }, { type: 'wrong', at: at + 0.1 });
      }
      if (s.erase) events.push({ type: 'erase', at: s.to - s.erase });
      el.style.visibility = 'hidden';
    });
    if (!R.static) {
      events.push({ type: 'hit', at: 0 }, { type: 'whoosh', at: 0 });
      const last = spec.scenes.at(-1);
      events.push({ type: 'whoosh', at: last.to - 1.6 });
      // Chalk dust puffed out along each wipe.
      spec.scenes.forEach((s, i) => {
        if (!R.paths[i]) return;
        const r = rngf(500 + i);
        for (let k = 0; k < 34; k++) {
          const p = k / 34;
          const [x, y] = pathUpTo(R.paths[i], p).at(-1);
          R.particles.push({ x: x + (r() - 0.5) * 220, y: y + 40 + (r() - 0.5) * 60, at: s.to - s.erase + p * s.erase, vx: (r() - 0.5) * 120, vy: -40 - r() * 80, spin: 0, size: 6 + r() * 14, color: 'rgba(120,128,150,.35)', shape: 0, life: 0.7 + r() * 0.5, dust: true });
        }
      });
    }
    R.cam = cameraPlan(spec.scenes);
    const confetti = document.querySelector('.confetti');
    confetti.innerHTML = R.particles.map((p) => `<i class="pt s${p.shape}${p.dust ? ' d' : ''}" style="width:${p.size}px;height:${p.shape === 1 && !p.dust ? p.size * 0.4 : p.size}px;background:${p.shape === 2 ? 'none' : p.color};color:${p.color}"></i>`).join('');
    R.ptEls = [...confetti.children];
    const camInit = R.static ? { cx: 540, cy: 960, z: 1 } : { cx: R.cam[0].cx, cy: R.cam[0].cy, z: R.cam[0].z };
    R.camF = follower(camInit);
    R.penF = follower({ x: 1180, y: 2050, lift: 1 });
    if (R.static) document.querySelector('.pen').style.display = 'none';
    return events;
  };

  /* ---------- one frame ---------- */

  window.seek = (t) => {
    const show = (it) => R.static || it.start < 0;

    // Camera.
    const keyAt = (u) => {
      let k = R.cam[0];
      for (const c of R.cam) if (c.at <= u) k = c;
      return k;
    };
    const cam = R.static ? { cx: 540, cy: 960, z: 1 } : (R.camF(t, (u) => clampCam(keyAt(u)), (u) => keyAt(u).w));
    const drift = R.static ? 0 : Math.sin(t * 0.7) * 0.25;
    document.querySelector('.cam').style.transform = `translate(${W / 2}px, ${H / 2}px) scale(${cam.z.toFixed(4)}) rotate(${(-0.6 + drift).toFixed(3)}deg) translate(${(-cam.cx).toFixed(2)}px, ${(-cam.cy).toFixed(2)}px)`;

    // Items.
    for (const it of R.items) {
      const local = t - it.scene.from - it.start;
      if (it.kind === 'hl') {
        const p = show(it) ? 1 : ease(local / it.dur);
        for (const m of it.el.querySelectorAll('.hl, .x')) m.style.setProperty('--p', p.toFixed(3));
        continue;
      }
      if (it.type === 'kicker') {
        const written = show(it) ? 1 : clamp(local / it.dur);
        it.el.querySelector('.hl').style.setProperty('--p', written.toFixed(3));
      }
      if (it.type === 'step' || it.type === 'option') {
        // The whole row lands with a spring: from the right, slightly turned.
        const sp = show(it) ? 1 : spring(local, 14, 0.6);
        it.el.style.opacity = show(it) || local >= 0 ? 1 : 0;
        const rot = it.type === 'option' ? [-1.6, 1.2, -0.8][it.card % 3] : 0;
        it.el.style.transform = `translateX(${((1 - sp) * 260).toFixed(1)}px) rotate(${(rot * sp + (1 - sp) * 6).toFixed(2)}deg)`;
      }
      for (const u of it.units) {
        const k = show(it) ? 99 : local - u.at;
        if (it.kind === 'pop') {
          const sp = spring(k, 18, 0.5);
          u.el.style.opacity = k > 0 ? clamp(k / 0.08) : 0;
          u.el.style.transform = `translateY(${((1 - sp) * 26).toFixed(1)}px) scale(${(0.82 + 0.18 * sp).toFixed(3)})`;
        } else {
          const e = clamp(k * 9);
          u.el.style.clipPath = e >= 1 ? 'none' : `inset(-20% ${((1 - e) * 100).toFixed(1)}% -20% -5%)`;
          u.el.style.opacity = e > 0 ? 1 : 0;
        }
      }
      if (it.mark && !show(it)) {
        // ✓: the line punches up. ✗: the line shakes.
        const u = local - it.dur;
        const line = it.line.el;
        if (it.mark === 'ok') line.style.transform = u > 0 ? `scale(${(1 + 0.12 * Math.exp(-5 * u) * Math.sin(Math.min(u * 14, Math.PI))).toFixed(4)})` : '';
        else line.style.transform = u > 0 ? `translateX(${(16 * Math.exp(-6 * u) * Math.sin(u * 42)).toFixed(2)}px)` : '';
        line.style.transformOrigin = 'left center';
      }
    }

    // Scenes, eraser, dust.
    const eraser = document.querySelector('.eraser');
    const dust = document.querySelector('.dust');
    eraser.style.display = 'none';
    for (const d of dust.children) d.setAttribute('d', '');
    document.querySelectorAll('.scene').forEach((el, i) => {
      const s = R.scenes[i];
      const on = R.static || (t >= s.from && (s.last || t < s.to));
      el.style.visibility = on ? 'visible' : 'hidden';
      el.style.maskImage = el.style.webkitMaskImage = 'none';
      const path = R.paths[i];
      if (!path || R.static) return;
      const e0 = s.to - s.erase;
      if (t >= e0 && t < s.to + 0.5) {
        const p = ease(Math.min(1, (t - e0) / s.erase) * 0.92 + 0.04);
        const done = pathUpTo(path, p);
        const d = svgPath(done);
        if (t < s.to) {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><mask id="m"><rect width="${W}" height="${H}" fill="white"/><path d="${d}" fill="none" stroke="black" stroke-width="${ERASE_W}" stroke-linecap="round" stroke-linejoin="round"/></mask><rect width="${W}" height="${H}" fill="black" mask="url(#m)"/></svg>`;
          el.style.maskImage = el.style.webkitMaskImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
          const [x, y] = done.at(-1);
          const prev = done.at(-2) ?? done[0];
          eraser.style.display = 'block';
          eraser.style.transform = `translate(${(x - 165).toFixed(1)}px, ${(y - 64).toFixed(1)}px) rotate(${x >= prev[0] ? -7 : 7}deg)`;
        }
        for (const streak of dust.children) streak.setAttribute('d', d);
        dust.style.opacity = t < s.to ? 1 : (1 - (t - s.to) / 0.5).toFixed(3);
      }
    });

    // Particles.
    R.particles.forEach((p, k) => {
      const el = R.ptEls[k];
      const u = t - p.at;
      if (R.static || u < 0 || u > p.life) {
        el.style.display = 'none';
        return;
      }
      const g = p.dust ? 60 : 1500;
      const drag = p.dust ? 1 : Math.exp(-1.6 * u);
      const x = p.x + p.vx * u * drag;
      const y = p.y + p.vy * u * drag + 0.5 * g * u * u;
      el.style.display = 'block';
      el.style.opacity = (1 - u / p.life).toFixed(3);
      el.style.transform = `translate(${(x - p.size / 2).toFixed(1)}px, ${(y - p.size / 2).toFixed(1)}px) rotate(${(p.spin * u).toFixed(1)}deg) scale(${p.dust ? (1 + u * 1.5).toFixed(2) : 1})`;
    });

    // Pen.
    if (!R.static) {
      const pen = R.penF(t, penTarget, (u) => (penTarget(u).lift ? 9 : 30));
      const lift = clamp(pen.lift);
      document.querySelector('.pen').style.transform = `translate(${pen.x.toFixed(1)}px, ${(pen.y - lift * 26).toFixed(1)}px) scale(.8)`;
      document.querySelector('.pen .shadow').style.transform = `translate(${(18 + lift * 30).toFixed(1)}px, ${(26 + lift * 34).toFixed(1)}px)`;
    }

    // Film grain moves every frame, like real film.
    document.querySelector('.film feTurbulence').setAttribute('seed', String(Math.floor(t * 24) % 97 + 1));

    // Subtitles: words spring in as they're said; the one being said is yellow.
    const subs = document.getElementById('subs');
    const cue = R.static ? null : R.subs.find((c) => t >= c.start && t < c.end);
    subs.innerHTML = cue ? cue.words.map((w, k) => {
      const u = t - w.start;
      const now = u >= 0 && (k === cue.words.length - 1 || t < cue.words[k + 1].start);
      const sp = spring(u, 20, 0.5);
      return `<span class="sw${now ? ' now' : ''}" style="opacity:${u >= 0 ? 1 : 0};transform:translateY(${((1 - sp) * 30).toFixed(1)}px) scale(${(0.7 + 0.3 * sp).toFixed(3)})">${esc(w.text)}</span>`;
    }).join(' ') : '';
  };

  /** A ballpoint pen, tip at (0, 0), held from the bottom right. */
  const PEN = `<svg class="shadow" width="700" height="700" viewBox="0 0 700 700" style="position:absolute;left:0;top:0;filter:blur(14px);opacity:.28"><g transform="rotate(-38)"><rect x="-26" y="40" width="52" height="560" rx="26" fill="#0b1020"/></g></svg>
    <svg width="700" height="700" viewBox="0 0 700 700" style="position:absolute;left:0;top:0;overflow:visible"><g transform="rotate(-38)">
      <path d="M0 0 L-9 34 L9 34 Z" fill="#2b2f36"/>
      <path d="M-9 34 L-22 92 L22 92 L9 34 Z" fill="#c9ced8"/>
      <path d="M-9 34 L-14 92 L-4 92 L-2 34 Z" fill="#eef1f6" opacity=".8"/>
      <rect x="-24" y="90" width="48" height="140" rx="10" fill="#1c2a4a"/>
      <g fill="#2a3a63">${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="-24" y="${104 + k * 20}" width="48" height="6" rx="3"/>`).join('')}</g>
      <rect x="-26" y="226" width="52" height="380" rx="14" fill="var(--pen)"/>
      <rect x="-26" y="226" width="16" height="380" rx="8" fill="#ffffff" opacity=".18"/>
      <rect x="10" y="226" width="16" height="380" rx="8" fill="#000" opacity=".14"/>
      <rect x="-30" y="600" width="60" height="70" rx="16" fill="#1c2a4a"/>
      <path d="M18 470 L34 470 L34 650 Q34 668 22 668 L18 668 Z" fill="#c9ced8"/>
    </g></svg>`;
})();
