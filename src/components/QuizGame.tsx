'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Question } from '@/types/quiz'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function lessonLabel(lesson: string): string {
  return lesson
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface Props {
  questions: Question[]
}

export default function QuizGame({ questions }: Props) {
  const [deck, setDeck] = useState<Question[]>(questions)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  useEffect(() => {
    setDeck(shuffle(questions))
  }, [questions])

  const current = deck[index]

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (selected !== null) return
      setSelected(optionIndex)
      setScore((prev) => ({
        correct:
          optionIndex === current.correctIndex ? prev.correct + 1 : prev.correct,
        total: prev.total + 1,
      }))
    },
    [selected, current],
  )

  const handleNext = useCallback(() => {
    if (index + 1 >= deck.length) {
      setDeck(shuffle(questions))
      setIndex(0)
    } else {
      setIndex((i) => i + 1)
    }
    setSelected(null)
  }, [index, deck.length, questions])

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-4">
          <p className="text-2xl font-semibold text-gray-300">No questions yet.</p>
          <p className="text-gray-500">
            Run{' '}
            <code className="bg-gray-800 px-2 py-1 rounded text-sm font-mono">
              yarn generate
            </code>{' '}
            to build the question bank.
          </p>
        </div>
      </div>
    )
  }

  const answered = selected !== null
  const isCorrect = selected === current.correctIndex

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-bold text-white tracking-tight">
            Claude Cert Study
          </h1>
          <span className="text-sm text-gray-400 tabular-nums">
            {score.correct}&thinsp;/&thinsp;{score.total} correct
          </span>
        </div>
      </header>

      <div className="flex-1 px-4 py-8">
        <div className="w-full max-w-2xl mx-auto space-y-5">
          {/* Lesson badge + deck progress */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
              {lessonLabel(current.lesson)}
            </span>
          </div>

          {/* Question card */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <p className="text-lg font-medium text-white leading-relaxed">
              {current.question}
            </p>
          </div>

          {/* Answer options */}
          <div className="space-y-3">
            {current.options.map((option, i) => {
              const isThisCorrect = i === current.correctIndex
              const isThisSelected = i === selected

              let className =
                'w-full text-left px-5 py-4 rounded-xl border text-sm leading-snug transition-colors duration-150 '

              if (!answered) {
                className +=
                  'bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-gray-600 cursor-pointer text-gray-200'
              } else if (isThisCorrect) {
                className += 'bg-emerald-950 border-emerald-500 text-emerald-100'
              } else if (isThisSelected) {
                className += 'bg-red-950 border-red-500 text-red-200'
              } else {
                className += 'bg-gray-900 border-gray-800 text-gray-500'
              }

              return (
                <button
                  key={i}
                  className={className}
                  onClick={() => handleSelect(i)}
                  disabled={answered}
                >
                  <span className="flex items-start gap-3">
                    <span className="shrink-0 text-gray-500 font-mono text-xs mt-0.5 w-4">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span>{option}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Explanation + Next */}
          {answered && (
            <div className="space-y-3 pt-1">
              <div
                className={`rounded-xl p-4 border ${
                  isCorrect
                    ? 'bg-emerald-950/60 border-emerald-800'
                    : 'bg-red-950/60 border-red-800'
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isCorrect ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isCorrect ? 'Correct' : 'Incorrect'}
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {current.explanation}
                </p>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-white text-gray-950 font-semibold py-4 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 text-sm"
              >
                Next question →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
