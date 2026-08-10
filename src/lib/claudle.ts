import type { Question } from '@/types/quiz'

const SESSION_KEY = 'claudle:session'
const QUESTIONS_PER_SESSION = 5
// How many entries at each deck boundary are kept collision-free, in questions.
// A question can only ever repeat across a deck change, and this is what keeps
// that repeat from landing too soon after the previous one: five sessions' worth
// on each side puts the floor at a 5-day gap. Raising it widens that floor but
// leaves the swap loop below less room to resolve collisions.
const BOUNDARY_GUARD = QUESTIONS_PER_SESSION * 5

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

// Days elapsed since the Unix epoch for a YYYY-MM-DD key. This is what advances
// the deck, so the sequence is continuous across dates rather than re-derived
// from scratch each day.
function dayIndexFromKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

// The guard needs a head, a tail, and a middle to swap through, so a small bank
// gets a proportionally smaller one rather than silently losing the guard.
function guardWidth(n: number): number {
  return Math.min(BOUNDARY_GUARD, Math.floor(n / 3))
}

// One deck is a full permutation of the bank. Walking it 5 at a time means every
// question is drawn exactly once before any of them comes back.
function buildDeck(allQuestions: Question[], deckIndex: number): Question[] {
  const deck = seededShuffle(allQuestions, hashToSeed(`claudle-deck-${deckIndex}`))
  const guard = guardWidth(deck.length)
  if (deckIndex <= 0 || guard < 1) return deck

  const prevTail = new Set(
    seededShuffle(allQuestions, hashToSeed(`claudle-deck-${deckIndex - 1}`))
      .slice(-guard)
      .map((q) => q.id),
  )

  // Deal collisions out of the head by swapping them into the deck's middle.
  // The tail is deliberately left untouched: that keeps a deck's tail identical
  // to its unadjusted form, so the lookup above never has to recurse backwards
  // through every earlier deck to know what it is.
  for (let i = 0; i < guard; i++) {
    if (!prevTail.has(deck[i].id)) continue
    for (let j = guard; j < deck.length - guard; j++) {
      if (prevTail.has(deck[j].id)) continue
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
      break
    }
  }
  return deck
}

export function selectDailyQuestions(allQuestions: Question[], dateKey: string): string[] {
  const n = allQuestions.length
  if (n <= QUESTIONS_PER_SESSION) return allQuestions.map((q) => q.id)

  const position = dayIndexFromKey(dateKey) * QUESTIONS_PER_SESSION
  const deckIndex = Math.floor(position / n)
  const offset = position % n

  const ids = buildDeck(allQuestions, deckIndex)
    .slice(offset, offset + QUESTIONS_PER_SESSION)
    .map((q) => q.id)

  // The bank size is not necessarily a multiple of 5, so the last draw of a deck
  // can run short and is topped up from the front of the next one. The guard
  // normally keeps those two ends apart, but it can only do so much on a small
  // bank - skipping ids already drawn today is what actually guarantees five
  // distinct questions.
  if (ids.length < QUESTIONS_PER_SESSION) {
    for (const q of buildDeck(allQuestions, deckIndex + 1)) {
      if (ids.length === QUESTIONS_PER_SESSION) break
      if (!ids.includes(q.id)) ids.push(q.id)
    }
  }
  return ids
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

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
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
    `CCA-F Study of the day : ${correctCount}/${questions.length}`,
    '',
    squares,
    '',
    'Study the Claude Certified Architect certification !',
    'https://claude.bernard.sh/claudle',
  ].join('\n')
}
