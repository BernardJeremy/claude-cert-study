# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 14 flashcard/quiz app for studying the Claude API certification. Two phases:

1. **Question generation** (`yarn generate`): reads HTML lesson files from `HTML/`, calls the Anthropic API, writes JSON question banks to `public/questions/`
2. **Quiz UI** (`yarn dev`): reads the generated JSON and presents a shuffled multiple-choice quiz

## Commands

| Command | Purpose |
|---|---|
| `yarn dev` | Start Next.js dev server |
| `yarn build` | Production build |
| `yarn start` | Start production server |
| `yarn lint` | ESLint via `next lint` |
| `yarn generate` | Generate question JSON from HTML source files |

## Key Gotchas

- **`HTML/` is gitignored** — lesson source files must be provided out-of-band before `yarn generate` works. `public/questions/*.json` are pre-committed so the quiz runs without regenerating.
- **`yarn generate` uses `tsx`** (not ts-node) with `scripts/tsconfig.json`, which sets `module: Node16` — distinct from the main app's `moduleResolution: bundler`. Do not conflate these two tsconfigs.
- The generator inserts a 300ms delay between Anthropic API calls and skips files under 100 words.
- **`.env` is committed** — only `.env*.local` variants are gitignored. The file contains a live `ANTHROPIC_API_KEY`; avoid accidentally exposing or overwriting it.

## Environment

`ANTHROPIC_API_KEY` is required. `ANTHROPIC_MODEL` is optional (defaults to `claude-haiku-4-5-20251001`).

## TypeScript / Code Style

- `strict: true` throughout
- Path alias: `@/*` → `./src/*`
- No Prettier configured — formatting is not enforced by tooling

## Deployment

Docker via `node:24-alpine` with Next.js standalone output (`output: 'standalone'` in `next.config.mjs`). The final runner stage copies only `.next/standalone/`, `.next/static/`, and `public/` — no full `node_modules` in the runtime image.

The `.env` file (API key) is excluded from the image via `.dockerignore`; the quiz reads pre-baked JSON from `public/questions/` and needs no API key at runtime.

```bash
docker build -t claude-cert-study .
docker run -p 3000:3000 claude-cert-study
```

## Testing

No test framework is configured.
