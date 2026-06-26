import Anthropic from '@anthropic-ai/sdk'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
const MIN_WORD_COUNT = 100
const DELAY_MS = 300

const LESSONS = [
  { id: 'claude-code-in-action', dir: 'claude-code-in-action' },
  { id: 'claude-with-the-anthropic-api', dir: 'claude-with-the-anthropic-api' },
  {
    id: 'introduction-to-model-context-protocol',
    dir: 'introduction-to-model-context-protocol',
  },
  { id: 'introduction-to-agent-skills', dir: 'introduction-to-agent-skills' },
]

interface RawQuestion {
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
}

interface Question extends RawQuestion {
  id: string
  classFile: string
  lesson: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function extractJson(text: string): string {
  // Strip markdown code fences if the model wraps the response
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : text.trim()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateQuestionsForClass(
  content: string,
  classFile: string,
  lesson: string,
): Promise<Question[]> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a quiz generator for a Claude API certification course.

Generate exactly 3 multiple-choice questions based on the class content below and ONLY based on the class content bellow. Do not use any external knowledge you may have.
Each question must have exactly 4 answer options with only one correct answer.
Return ONLY a valid JSON array — no markdown fences, no explanation, no wrapper text.

Schema:
[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctIndex": 0,
    "explanation": "string (1 sentence explaining why the correct answer is right)"
  }
]

<class_content>
${content}
</class_content>`,
      },
    ],
  })

  const raw = message.content.find((b) => b.type === 'text')?.text ?? '[]'
  const parsed: RawQuestion[] = JSON.parse(extractJson(raw))

  return parsed.map((q, i) => ({
    ...q,
    id: `${classFile}-q${i}`,
    classFile,
    lesson,
  }))
}

async function processLesson(lessonId: string, lessonDir: string): Promise<Question[]> {
  const htmlDir = path.join(process.cwd(), 'HTML', lessonDir)
  const files = (await fs.readdir(htmlDir))
    .filter((f) => f.endsWith('.html'))
    .sort()

  const questions: Question[] = []

  for (const file of files) {
    const classFile = path.basename(file, '.html')
    const html = await fs.readFile(path.join(htmlDir, file), 'utf-8')
    const text = stripHtml(html)
    const words = wordCount(text)

    if (words < MIN_WORD_COUNT) {
      console.log(`  ⏭  Skipping ${file} (${words} words — too short)`)
      continue
    }

    process.stdout.write(`  ⚙  Processing ${file} (${words} words)... `)
    try {
      const qs = await generateQuestionsForClass(text, classFile, lessonId)
      questions.push(...qs)
      console.log(`✓ ${qs.length} questions`)
    } catch (err) {
      console.error(`✗ failed`)
      console.error(`     ${err instanceof Error ? err.message : String(err)}`)
    }

    await delay(DELAY_MS)
  }

  return questions
}

async function main() {
  await fs.mkdir(path.join(process.cwd(), 'public', 'questions'), { recursive: true })

  let totalQuestions = 0

  for (const { id, dir } of LESSONS) {
    console.log(`\n📚 ${id}`)
    const questions = await processLesson(id, dir)
    totalQuestions += questions.length

    const outPath = path.join(process.cwd(), 'public', 'questions', `${id}.json`)
    await fs.writeFile(outPath, JSON.stringify({ lesson: id, questions }, null, 2))
    console.log(`✅ Wrote ${questions.length} questions → public/questions/${id}.json`)
  }

  console.log(`\n🎉 Done! ${totalQuestions} questions total.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
