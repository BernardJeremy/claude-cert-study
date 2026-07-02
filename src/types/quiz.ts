export interface Question {
  id: string
  classFile: string
  lesson: string
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  rule: string
}

export interface LessonBank {
  lesson: string
  questions: Question[]
}
