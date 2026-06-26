'use client'

import dynamic from 'next/dynamic'
import type { Question } from '@/types/quiz'

const QuizGame = dynamic(() => import('./QuizGame'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-600 text-sm">Loading questions…</p>
    </div>
  ),
})

export default function QuizGameLoader({ questions }: { questions: Question[] }) {
  return <QuizGame questions={questions} />
}
