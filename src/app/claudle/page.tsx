import { promises as fs } from 'fs'
import path from 'path'
import ClaudleLoader from '@/components/ClaudleLoader'
import type { LessonBank, Question } from '@/types/quiz'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Claudle | Claude Cert Study',
  description: 'Daily 5-question Claude certification challenge.',
}

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

export default async function Claudle() {
  const questions = await loadQuestions()

  return (
    <main className="min-h-screen">
      <ClaudleLoader questions={questions} />
    </main>
  )
}
