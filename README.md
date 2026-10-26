# nicolas-scapusio

Automatic Instagram publisher for Nicolás Scapusio's account (same system as gestaltparaelalma).

- `queue/`: approved posts (images + caption + date). GitHub Actions publishes the ones that are due. Format and commands in [queue/README.md](queue/README.md).
- `scripts/`: publisher (`ig.mjs`), review page (`review.mjs`), renderer (`render.mjs`) and helpers. Tests: `npm test`.
- `Revisar posts.command`: double-click to open the review page.
