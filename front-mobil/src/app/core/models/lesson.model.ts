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
