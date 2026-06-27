import Anthropic from '@anthropic-ai/sdk'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
const DELAY_MS = 400
const IMBALANCE_THRESHOLD = 2.0

interface Question {
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  id: string
  classFile: string
  lesson: string
}

function isImbalanced(options: string[]): boolean {
  const lens = options.map((o) => o.length)
  return Math.max(...lens) / Math.min(...lens) > IMBALANCE_THRESHOLD
}

async function rebalanceOptions(q: Question): Promise<[string, string, string, string]> {
  const prompt = `You are editing quiz answer options to ensure they have similar character lengths, so students cannot guess the correct answer by length alone.

Question: ${q.question}

Current options (index ${q.correctIndex} is correct):
0: ${q.options[0]}
1: ${q.options[1]}
2: ${q.options[2]}
3: ${q.options[3]}

Correct answer explanation: ${q.explanation}

Rules:
- Option ${q.correctIndex} is the correct answer — keep its meaning exactly correct, rephrase only if needed
- All wrong options must remain clearly wrong
- Rewrite options so all 4 have similar character counts (within ~25% of each other)
- Expand short wrong answers with plausible-sounding but incorrect technical detail
- Write naturally — no padding or filler
- Do NOT change which option is correct

Respond with ONLY a JSON array of exactly 4 strings, no commentary:
["option0", "option1", "option2", "option3"]`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`Bad response for question ${q.id}: ${text}`)

  const options = JSON.parse(match[0]) as string[]
  if (options.length !== 4) throw new Error(`Expected 4 options for ${q.id}, got ${options.length}`)

  return options as [string, string, string, string]
}

async function processFile(filePath: string): Promise<void> {
  const raw = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(raw) as { questions: Question[] }
  let fixed = 0

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i]
    if (!isImbalanced(q.options)) continue

    const lens = q.options.map((o) => o.length)
    console.log(`  [${i}] ${q.id} — lengths: ${lens.join(', ')}`)

    try {
      const newOptions = await rebalanceOptions(q)
      const newLens = newOptions.map((o) => o.length)
      console.log(`       → ${newLens.join(', ')}`)
      data.questions[i] = { ...q, options: newOptions }
      fixed++
    } catch (err) {
      console.error(`  ERROR on ${q.id}:`, err)
    }

    await new Promise((r) => setTimeout(r, DELAY_MS))
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`  → ${fixed} questions fixed in ${path.basename(filePath)}`)
}

async function main() {
  const questionsDir = path.join(process.cwd(), 'public', 'questions')
  const files = (await fs.readdir(questionsDir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(questionsDir, f))

  for (const file of files) {
    console.log(`\nProcessing ${path.basename(file)}...`)
    await processFile(file)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
