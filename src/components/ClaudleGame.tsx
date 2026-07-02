'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Question } from '@/types/quiz'
import {
  getOrCreateTodaysSession,
  saveSession,
  buildShareText,
  type ClaudleSession,
} from '@/lib/claudle'

function lessonLabel(lesson: string): string {
  return lesson
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface Props {
  questions: Question[]
}

export default function ClaudleGame({ questions }: Props) {
  const [session, setSession] = useState<ClaudleSession | null>(null)
  const [viewIndex, setViewIndex] = useState(0)

  useEffect(() => {
    const s = getOrCreateTodaysSession(questions)
    setSession(s)
    const firstUnanswered = s.answers.findIndex((a) => a === null)
    setViewIndex(firstUnanswered === -1 ? s.answers.length - 1 : firstUnanswered)
  }, [questions])

  const sessionQuestions = useMemo(() => {
    if (!session) return []
    return session.questionIds.map((id) => questions.find((q) => q.id === id)!)
  }, [session, questions])

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (!session || session.answers[viewIndex] !== null) return
      const nextAnswers = [...session.answers]
      nextAnswers[viewIndex] = optionIndex
      const nextSession: ClaudleSession = { ...session, answers: nextAnswers }
      setSession(nextSession)
      saveSession(nextSession)
    },
    [session, viewIndex],
  )

  const handleNext = useCallback(() => {
    if (!session) return
    if (viewIndex === session.questionIds.length - 1) {
      const nextSession: ClaudleSession = { ...session, finished: true }
      setSession(nextSession)
      saveSession(nextSession)
    } else {
      setViewIndex((i) => i + 1)
    }
  }, [session, viewIndex])

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 text-sm">Loading questions…</p>
      </div>
    )
  }

  if (session.finished) {
    return <ClaudleResults session={session} questions={sessionQuestions} />
  }

  const currentQuestion = sessionQuestions[viewIndex]

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <p className="text-gray-500">Something went wrong loading today&apos;s Claudle.</p>
      </div>
    )
  }

  const selected = session.answers[viewIndex]
  const answered = selected !== null
  const isCorrect = selected === currentQuestion.correctIndex
  const isLast = viewIndex === session.questionIds.length - 1
  const correctSoFar = session.answers.filter(
    (a, i) => a !== null && a === sessionQuestions[i]?.correctIndex,
  ).length

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-bold text-white tracking-tight">Claudle</h1>
          <span className="text-sm text-gray-400 tabular-nums">
            {correctSoFar}&thinsp;/&thinsp;{session.questionIds.length} correct
          </span>
        </div>
      </header>

      <div className="flex-1 px-4 py-8">
        <div className="w-full max-w-2xl mx-auto space-y-5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-medium bg-gray-800 text-gray-400 px-3 py-1 rounded-lg">
              {lessonLabel(currentQuestion.lesson)}
            </span>
            <span className="text-xs font-mono text-gray-600 shrink-0 text-right">
              {viewIndex + 1} / {session.questionIds.length}
            </span>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <p className="text-base font-medium text-white leading-relaxed">
              {currentQuestion.question}
            </p>
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, i) => {
              const isThisCorrect = i === currentQuestion.correctIndex
              const isThisSelected = i === selected

              let className =
                'w-full text-left px-5 py-3 rounded-xl border text-sm leading-snug transition-colors duration-150 '

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
                  {currentQuestion.explanation}
                </p>
              </div>

              <div className="rounded-xl p-4 border bg-indigo-950/60 border-indigo-800">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5 text-indigo-400">
                  Rule to remember
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">{currentQuestion.rule}</p>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-white text-gray-950 font-semibold py-4 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 text-sm"
              >
                {isLast ? 'See results →' : 'Next question →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ClaudleResults({
  session,
  questions,
}: {
  session: ClaudleSession
  questions: Question[]
}) {
  const [copied, setCopied] = useState(false)

  const answers = session.answers as number[]
  const correctCount = answers.filter((a, i) => a === questions[i]?.correctIndex).length

  const handleCopy = useCallback(async () => {
    const text = buildShareText(answers, questions)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [answers, questions])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-bold text-white tracking-tight">Claudle</h1>
        </div>
      </header>
      <div className="flex-1 px-4 py-8">
        <div className="w-full max-w-2xl mx-auto space-y-6 text-center">
          <p className="text-3xl font-bold text-white tabular-nums">
            {correctCount}&thinsp;/&thinsp;{questions.length}
          </p>
          <div className="flex justify-center gap-2">
            {answers.map((a, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded ${
                  a === questions[i]?.correctIndex ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleCopy}
            className="w-full bg-white text-gray-950 font-semibold py-4 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 text-sm"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <p className="text-xs text-gray-600">A new Claudle will be available tomorrow.</p>
        </div>
      </div>
    </div>
  )
}
