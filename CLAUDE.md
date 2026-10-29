# nicolas-scapusio: Instagram autopilot

Same system as `/Users/facundobarboza/gestaltparaelalma` (the @gestaltparaelalma autopilot), copied on 2026-10-26 for a different Instagram account, niche and content. The publisher, review page and renderer are the same code; only the account, the look and the content change. When something is unclear, read gestaltparaelalma's `CLAUDE.md`: it records every decision and gotcha (GitHub's late scheduler, cron-job.org second clock, token refresh, jsDelivr for reels).

This repo must be PUBLIC before the first post: Instagram downloads every image from its raw GitHub URL (`https://raw.githubusercontent.com/facubarboza22/nicolas-scapusio/main/queue/...`), and videos from jsDelivr, and neither works on a private repo. So never commit secrets, emails, phone numbers or private notes: those live in `.env` and `CLAUDE.local.md` (both gitignored).

## How it works (same as gestaltparaelalma, cost $0)

| Piece | What | Where |
|---|---|---|
| Generate | Claude writes captions and renders images for the week | This Mac, `drafts/` (gitignored) |
| Approve | Someone reviews drafts on the local review page (`Revisar posts.command`, http://localhost:5179) | This Mac |
| Queue | Approved posts as folders: images + caption + scheduled date | `queue/` (format in `queue/README.md`) |
| Publish | GitHub Actions every 2 h publishes the oldest due post | `.github/workflows/publish.yml` |
| Access | Meta app + long-lived Instagram token | GitHub secret `IG_ACCESS_TOKEN`, repo variable `IG_TOKEN_EXPIRES_AT`, local `.env` |

- Review page runs on port **5179** (gestaltparaelalma's uses 5178, so both can be open at once).
- Push works only with the repo-local credential helper (`credential.helper=` then `!gh auth git-credential`): the macOS keychain holds a work GitHub credential that gets a 403.
- `node_modules/playwright*` are symlinks to playpremodern's copy, same as gestaltparaelalma.
- Tests: `npm test` (`node --test scripts/*.test.mjs`).

## The account (proposal 2026-10-27, not yet approved by Nicolás)

Nicolás Scapusio, licenciado and teacher of Mathematics and Physics. Goal: new students for private lessons. Reels bring new audience (main format), carousels get saved, stories are done by hand. Brand **copérnico** (all lowercase, "nico" in pen blue), account `@copernico.clases` (created 2026-10-27, display name "Lic. Nicolas Scapusio", bio set; open in the Chrome profile "gestalt", which also holds @gestaltparaelalma: check the active account first): see `docs/marca.md`.

- `scripts/render/slide.html` has the notebook look (squared paper, navy ink, blue pen, yellow highlighter, red corrections; Bricolage Grotesque / Atkinson Hyperlegible / Kalam). Handle and signature are the `HANDLE` and `SIGN` constants at the top of its script. Themes: `mate` (blue) and `fisica` (orange).
- Reels are drawn by `scripts/render/reel.js` (loaded by slide.html): a notebook on a dark desk filmed by a virtual camera (springs: pushes in on the hook, follows what is being written, punches in on ✓, pulls back at the end; the inked content always stays between the logo and the subtitles), a ballpoint pen whose tip follows the letters, word-by-word spring pops, confetti on ✓, a shake on ✗, chalk dust on the eraser, warm light, vignette, depth of field and film grain. Scene fields: `eq` (an exercise worked one line at a time, `[..]` highlighter, `~..~` cross-out, ✓/✗ marks, handwritten notes), `steps` (numbered list in red circles), `options` (A/B/C answer cards, `optionsAt`). Format documented at the top of reel.js.
- RULE (user, 2026-10-29): everything is published only to Instagram and watched on a phone, so every file is made to Instagram's specs, never bigger than needed. All the numbers live in `scripts/lib/instagram.mjs`: Reels 1080×1920, H.264 High yuv420p, 30 fps, keyframe every 2 s, AAC 128k 48 kHz, faststart, 3–90 s, under 18 MB (jsDelivr refuses over 20 MB; the bitrate is capped from the duration); slides 1080×1350 and covers 1080×1920, JPEG under 8 MB. `render.mjs` checks the finished reel with ffprobe and fails if Instagram would refuse it; the queue checks size, faststart and cover size again before publishing. Send the user the same file that will be published, not a separate copy.
- Render: 60 frames per second blended to 30 (motion blur, `SUBFRAMES` in `scripts/render.mjs`). A 47 s reel takes about 8 minutes.
- HARD RULE: every number, formula and unit in a post is computed or checked with a script before it goes to review, never written from memory. Record the check in the draft's `note`.
- Narrated reels (2026-10-27): each scene has a `say`; `scripts/lib/voice.mjs` gets it from ElevenLabs with word timings (voice "Ignacio", young Uruguayan, id in `DEFAULT_VOICE`; `"voice"` in the reel overrides it), cached in `drafts/_voz/` so re-renders spend no credits. Since 2026-10-29 the model is `eleven_v3` (stability 0 = most expressive) because the user found v2 "too neutral, without soul": write emotion tags in `say` (`[curious]`, `[playful]`, `[serious]`, `[confident]`, `[excited]`, `[warmly]`); they are not spoken and never reach the subtitles. v3 has no speed setting and refuses previous/next text, so clips are sped up with ffmpeg (`TEMPO` 1.2) and every take is a bit different (change the text to get a new one). `scripts/lib/timeline.mjs` turns that into scene times, subtitles and word cues (`"handAt": "espera"` writes the note when the word is said). Pen-style writing letter by letter, printed text word by word, a board eraser between scenes, subtitles under the content, no fades. Sound effects (ElevenLabs, generated once) in `drafts/_assets/sfx/` (local only): escribir, borrar, resaltar, tilde, correcto, error, golpe (hook), whoosh (camera moves), pop (answer cards); gains in `SFX` in `scripts/render.mjs`, mix normalised to −14 LUFS. No music for now (user, 2026-10-27).
- `ELEVENLABS_API_KEY` is in `.env` (same key as playpremodern's, Starter plan, ~36k characters a month; a 40 s reel uses ~500).
- References the user asked for (Instagram, 2026-10-27): the most-shared math reels show the whole exercise from frame one and write it by hand with coloured marks and ✓ (jambmathtutorials 186k likes, mastereducativo.megapacks 92k); multiple-choice options (a, b, c…) fill the comments (soydanielcarreon). None of those is narrated; narration + subtitles is our own call.
- First reel: `drafts/2026-11-02-seis-mas-cuatro-por-dos` ("pregunta rápida", narrated, ~47 s, ends with a 10 − 2 × (3 + 1) challenge as A/B/C cards; answer B = 2, posted in stories).

## What was copied as-is and still needs adapting

- `scripts/review/index.html` still shows the placeholder `@CUENTA`.
- `scripts/lib/queue.mjs` checks: no links and no phone numbers in captions, CTA by DM. Keep or change depending on this account's goal.
- Portrait for CTA slides: `drafts/_assets/retrato.jpg` (local only, not there yet).
- Still missing: `docs/estrategia.md` (topics, rhythm) and `docs/escritura.md` (voice, rules). gestaltparaelalma's versions show the format.

## Status

- [x] Code copied, repo name and review port adapted, tests pass (2026-10-26)
- [x] Pushed to `facubarboza22/nicolas-scapusio`. Workflow `publish.yml` enabled 2026-10-29 (every 2 h).
- [x] Niche and goal (2026-10-27). Brand proposed in `docs/marca.md`
- [x] Instagram account @copernico.clases created, bio set (2026-10-27)
- [ ] Profile photo: the logo for now (uploaded 2026-10-27), swap for a photo of Nicolás; who approves posts; country, levels, in person / online
- [x] Meta app `nicolas-publisher` created 2026-10-29 (app ID `1756751282085288`, Development mode, use case "Administrar mensajes y contenido en Instagram", no business portfolio) in the Chrome profile that owns the Meta dashboard (Claude in Chrome "Browser 2"; "Browser 1" is not signed in to developers). Permissions added: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`.
  - BUT Meta never showed "API setup with Instagram login" on this new app (only the Facebook-login setup, which needs a Facebook Page): a known Meta bug for apps created in Oct 2026 (github.com/ryanlaiyanip-ctrl/chatmany/issues/5). The app stays unused; @copernico.clases accepted its tester invite anyway.
- [x] DECISION (user, 2026-10-29): publish through gestaltparaelalma's app `gestalt-publisher` (app ID `1563617255075951`, Instagram app ID `1112821461091196`) instead. A token belongs to one account, so both accounts can share the app; the risk is that deleting or breaking that app stops both. Tester invite accepted 2026-10-29. If Meta fixes the bug, move to `nicolas-publisher`.
- [x] Token (2026-10-29): generated in the Meta dashboard (gestalt-publisher → Casos de uso → API de Instagram → Configuración de la API con el inicio de sesión de Instagram → "2. Genera identificadores de acceso" → "Generar identificador" on the copernico.clases row), saved as GitHub secret `IG_ACCESS_TOKEN` + `.env`, repo variable `IG_TOKEN_EXPIRES_AT` = 2026-12-28 (+ `.env`). Verified: @copernico.clases, `account_type` MEDIA_CREATOR, IG user ID `17841417723787916`, quota 100 per 24 h. **Expires ~2026-12-28 unless refreshed** (`node scripts/ig.mjs refresh`). Saving it needs the app's Terminal panel: the chat's `!` box can't take `read -s` input.
- [x] Repo made public (2026-10-29)
- [ ] cron-job.org second clock: new fine-grained token (Actions read/write, this repo only) + a job like "gestaltparaelalma publicar"
- [x] Look (slide.html) and first reel prototype (2026-10-27)
- [ ] Strategy and writing rules
- Approver: the user gave the green light for the first reel (2026-10-29, after Sofía and Nico reviewed it)
- [ ] First test post
