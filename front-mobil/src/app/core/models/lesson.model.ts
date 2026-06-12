export interface Lesson {
  id: number;
  text: string;
  title?: string;
}

export interface TypingResult {
  wpm: number;
  accuracy: number;
  timeSeconds: number;
  errors: number;
}

export interface LessonProgress {
  lessonId: number;
  bestWpm: number;
  lastWpm: number;
  lastAccuracy: number;
  lastTime: number;
  completedAt: string;
  timesCompleted: number;
}
