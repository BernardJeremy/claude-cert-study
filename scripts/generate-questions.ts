import Anthropic from '@anthropic-ai/sdk'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
const DELAY_MS = 300

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function scenarioToSlug(scenario: string): string {
  const n = scenario.trim().toLowerCase()
  if (n.includes('customer support')) return 'customer-support-agent'
  if (n.includes('code generation')) return 'code-generation-claude-code'
  if (n.includes('multi-agent research')) return 'multi-agent-research'
  if (n.includes('claude code for ci') || n.includes('claude code for continuous')) return 'claude-code-ci'
  if (n.includes('multi-file')) return 'multi-file-code-review'
  if (n.includes('conversational')) return 'conversational-ai'
  return n.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface QuestionBlock {
  header: string
  body: string
  scenario: string
}

function extractQuestionBlocks(markdown: string): QuestionBlock[] {
  const pattern = /^(## Question \d+[^\n]*)\n/gm
  const matches: { index: number; header: string }[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(markdown)) !== null) {
    matches.push({ index: match.index, header: match[1] })
  }

  return matches.map(({ index, header }, i) => {
    const bodyStart = index + header.length + 1
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index : markdown.length
    const body = markdown.slice(bodyStart, bodyEnd).trim()
    const scenarioMatch = header.match(/\(Scenario:\s*([^)]+)\)/)
    const scenario = scenarioMatch ? scenarioMatch[1].trim() : 'unknown'
    return { header, body, scenario }
  })
}

async function parseQuestionBlock(block: QuestionBlock, globalIndex: number): Promise<Question> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [
      {
        name: 'extract_question',
        description: 'Extract a structured exam question from markdown',
        input_schema: {
          type: 'object' as const,
          properties: {
            question: {
              type: 'string',
              description:
                'The Situation paragraph and question stem combined into one string, separated by a space',
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              minItems: 4,
              maxItems: 4,
              description:
                'The four answer option texts, WITHOUT the leading "A) " / "B) " prefix and WITHOUT the **[CORRECT]** marker',
            },
            correctIndex: {
              type: 'integer',
              minimum: 0,
              maximum: 3,
              description: '0-based index of the correct answer option',
            },
            explanation: {
              type: 'string',
              description:
                'The explanation text from the "Why X:" section, WITHOUT the "Why X:" prefix label',
            },
          },
          required: ['question', 'options', 'correctIndex', 'explanation'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'extract_question' },
    messages: [
      {
        role: 'user',
        content: `Parse this exam question from markdown into structured JSON.

Rules:
- question: combine the **Situation** paragraph and the bold question stem (e.g. "Which approach is best?") into one string if the stem is not present in the Situation paragraph. Otherwise, use the Situation paragraph as-is for the question.
- options: strip the letter prefix ("A) " etc.) and any **[CORRECT]** marker from each of the four options
- correctIndex: 0-based index of the option marked **[CORRECT]**
- explanation: text after "**Why X:**", omitting the "Why X:" label itself

<question_block>
${block.header}

${block.body}
</question_block>`,
      },
    ],
  })

  const toolUse = message.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('No tool_use block in response')
  }

  const raw = toolUse.input as { question: string; options: string[]; correctIndex: number; explanation: string }
  const slug = scenarioToSlug(block.scenario)

  return {
    question: raw.question,
    options: raw.options as [string, string, string, string],
    correctIndex: raw.correctIndex as 0 | 1 | 2 | 3,
    explanation: raw.explanation,
    id: `${slug}-q${globalIndex}`,
    classFile: 'guide',
    lesson: slug,
  }
}

async function main() {
  await fs.mkdir(path.join(process.cwd(), 'public', 'questions'), { recursive: true })

  const guidePath = path.join(process.cwd(), 'scripts', 'guide_en.md')
  const markdown = await fs.readFile(guidePath, 'utf-8')

  const blocks = extractQuestionBlocks(markdown)
  console.log(`Found ${blocks.length} questions in guide_en.md\n`)

  const questions: Question[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    process.stdout.write(
      `  ⚙  [${String(i + 1).padStart(2)}/${blocks.length}] ${block.header.slice(0, 55)}... `,
    )
    try {
      const q = await parseQuestionBlock(block, i)
      questions.push(q)
      console.log(`✓`)
    } catch (err) {
      console.error(`✗`)
      console.error(`       ${err instanceof Error ? err.message : String(err)}`)
    }

    if (i < blocks.length - 1) await delay(DELAY_MS)
  }

  const outPath = path.join(process.cwd(), 'public', 'questions', 'guide.json')
  await fs.writeFile(outPath, JSON.stringify({ lesson: 'guide', questions }, null, 2))
  console.log(`\n✅ Wrote ${questions.length} questions → public/questions/guide.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
