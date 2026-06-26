# Claude Certification Study

A flashcard/quiz app for studying the Claude API certification. Multiple-choice questions are generated from course HTML lesson files using the Anthropic API, then served as a shuffled quiz.

## How it works

1. **Generate** — reads HTML lesson files, calls the Anthropic API, writes JSON question banks to `public/questions/`
2. **Quiz** — Next.js app reads the JSON and presents a randomized multiple-choice quiz

Pre-generated question files are committed, so you can run the quiz without the HTML source files or an API key.

## Running locally

**Prerequisites:** Node 20+, Yarn

```bash
yarn install
yarn dev        # http://localhost:3000
```

## Regenerating questions

Requires course HTML files placed in `HTML/` (not committed) and an Anthropic API key.

```bash
cp .env .env.local   # or set ANTHROPIC_API_KEY in your environment
yarn generate
```

`ANTHROPIC_MODEL` is optional and defaults to `claude-haiku-4-5-20251001`.

## Running with Docker

```bash
docker build -t claude-cert-study .
docker run -p 3000:3000 claude-cert-study
```

The image uses Next.js standalone output on `node:24-alpine`, so the final layer is around 150–200 MB. The quiz reads question JSON baked into the image at build time — no API key needed at runtime.

## Project structure

```
public/questions/   # generated question banks (committed)
src/app/            # Next.js App Router pages
src/components/     # React components
src/types/          # TypeScript interfaces
scripts/            # question generation script
HTML/               # course HTML source files (gitignored, provide separately)
```
