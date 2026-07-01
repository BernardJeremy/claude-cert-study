# Claude Certification Study

A flashcard/quiz app for studying the Claude API certification. 88 multiple-choice questions are parsed from the study guide using the Anthropic API, then served as a shuffled quiz.

## How it works

1. **Generate** — reads `scripts/guide_en.md` (not committed; see Credits), calls the Anthropic API once per question to extract structured JSON, writes `public/questions/guide.json`
2. **Quiz** — Next.js app reads the JSON and presents a randomized multiple-choice quiz

A pre-generated `guide.json` is committed, so you can run the quiz without an API key.

## Running locally

**Prerequisites:** Node 20+, Yarn

```bash
yarn install
yarn dev        # http://localhost:3000
```

## Regenerating questions

Requires an Anthropic API key (makes 88 API calls).

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
public/questions/   # generated question bank (committed)
scripts/guide_en.md # study guide — not committed; download from Credits link
src/app/            # Next.js App Router pages
src/components/     # React components
src/types/          # TypeScript interfaces
scripts/            # question generation script
```

## Credits

Questions sourced from [paullarionov/claude-certified-architect](https://github.com/paullarionov/claude-certified-architect). The study guide (`scripts/guide_en.md`) is not committed — download it from [guide_en.md](https://github.com/paullarionov/claude-certified-architect/blob/main/guide_en.md) before regenerating questions.