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

## What was copied as-is and still needs adapting

- `scripts/render/slide.html`: still gestalt's look (sage + cream, Fraunces / Karla / Caveat, themes salvia / arcilla / bosque). Redesign it for this account once the niche is known. The handle is the placeholder `@CUENTA` (also in `scripts/review/index.html`); the cover mark says "nicolás scapusio" and the CTA signature "Nicolás".
- `scripts/lib/queue.mjs` checks: no links and no phone numbers in captions, CTA by DM. Keep or change depending on this account's goal.
- Portrait for CTA slides: `drafts/_assets/retrato.jpg` (local only, not there yet).
- No `docs/` yet: write `docs/estrategia.md` (themes, rhythm) and `docs/escritura.md` (voice, rules) for this account. gestaltparaelalma's versions show the format.

## Status

- [x] Code copied, repo name and review port adapted, tests pass (2026-10-26)
- [x] Pushed to `facubarboza22/nicolas-scapusio` (still private)
- [ ] Account, niche, voice and who approves posts: ask the user
- [ ] Meta app `nicolas-publisher` (Instagram API with Instagram Login), permissions `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`; the account accepts the tester invite
- [ ] Token: GitHub secret `IG_ACCESS_TOKEN` + `.env`, repo variable `IG_TOKEN_EXPIRES_AT`; verify with `node scripts/ig.mjs whoami`
- [ ] Repo made public
- [ ] cron-job.org second clock: new fine-grained token (Actions read/write, this repo only) + a job like "gestaltparaelalma publicar"
- [ ] Look (slide.html), strategy and writing rules
- [ ] First test post
