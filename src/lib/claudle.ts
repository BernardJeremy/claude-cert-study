import type { Question } from '@/types/quiz'

const SESSION_KEY = 'claudle:session'
const QUESTIONS_PER_SESSION = 5

export interface ClaudleSession {
  date: string
  questionIds: string[]
  answers: (number | null)[]
  finished: boolean
}

export function getTodayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Deterministic string hash (djb2 variant) so every visitor derives the same seed from the same date.
function hashToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

// mulberry32 seeded PRNG - small, deterministic, good enough for shuffling.
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed)
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function selectDailyQuestions(allQuestions: Question[], dateKey: string): string[] {
  const seed = hashToSeed(dateKey.replace(/-/g, '')) // YYYYMMDD
  return seededShuffle(allQuestions, seed)
    .slice(0, QUESTIONS_PER_SESSION)
    .map((q) => q.id)
}

export function loadSession(): ClaudleSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ClaudleSession
  } catch {
    return null
  }
}

export function saveSession(session: ClaudleSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getOrCreateTodaysSession(allQuestions: Question[]): ClaudleSession {
  const today = getTodayKey()
  const existing = loadSession()
  if (existing && existing.date === today) {
    return existing
  }

  const ids = selectDailyQuestions(allQuestions, today)
  const session: ClaudleSession = {
    date: today,
    questionIds: ids,
    answers: new Array(ids.length).fill(null),
    finished: false,
  }
  saveSession(session)
  return session
}

export function buildShareText(answers: number[], questions: Question[]): string {
  const correctCount = answers.filter((a, i) => a === questions[i].correctIndex).length
  const squares = answers
    .map((a, i) => (a === questions[i].correctIndex ? ':large_green_square:' : ':large_red_square:'))
    .join('')

  return [
    `CCA-F Study : ${correctCount}/${questions.length}`,
    '',
    squares,
    '',
    'Study the Claude Certified Architect certification !',
    'https://claudle.bernard.sh',
  ].join('\n')
}
