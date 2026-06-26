import { promises as fs } from 'fs'
import path from 'path'
import QuizGameLoader from '@/components/QuizGameLoader'
import type { LessonBank, Question } from '@/types/quiz'

const LESSONS = [
  'claude-code-in-action',
  'claude-with-the-anthropic-api',
  'introduction-to-model-context-protocol',
  'introduction-to-agent-skills',
]

async function loadQuestions(): Promise<Question[]> {
  const questionsDir = path.join(process.cwd(), 'public', 'questions')
  const allQuestions: Question[] = []

  for (const lesson of LESSONS) {
    try {
      const content = await fs.readFile(
        path.join(questionsDir, `${lesson}.json`),
        'utf-8',
      )
      const bank: LessonBank = JSON.parse(content)
      allQuestions.push(...bank.questions)
    } catch {
      // File not yet generated — skip silently
    }
  }

  return allQuestions
}

export default async function Home() {
  const questions = await loadQuestions()

  return (
    <main className="min-h-screen">
      <QuizGameLoader questions={questions} />
    </main>
  )
}
