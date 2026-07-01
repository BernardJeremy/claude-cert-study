import { promises as fs } from 'fs'
import path from 'path'
import QuizGameLoader from '@/components/QuizGameLoader'
import type { LessonBank, Question } from '@/types/quiz'

async function loadQuestions(): Promise<Question[]> {
  try {
    const content = await fs.readFile(
      path.join(process.cwd(), 'public', 'questions', 'guide.json'),
      'utf-8',
    )
    const bank: LessonBank = JSON.parse(content)
    return bank.questions
  } catch {
    return []
  }
}

export default async function Home() {
  const questions = await loadQuestions()

  return (
    <main className="min-h-screen">
      <QuizGameLoader questions={questions} />
    </main>
  )
}
