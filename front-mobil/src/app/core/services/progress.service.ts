import { Injectable } from '@angular/core';
import { LessonProgress, TypingResult } from '../models/lesson.model';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly KEY = 'tipografido_progress';

  getAll(): Record<number, LessonProgress> {
    const raw = localStorage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : {};
  }

  getLesson(lessonId: number): LessonProgress | null {
    return this.getAll()[lessonId] ?? null;
  }

  save(lessonId: number, result: TypingResult): void {
    const all = this.getAll();
    const prev = all[lessonId];
    all[lessonId] = {
      lessonId,
      bestWpm: prev ? Math.max(prev.bestWpm, result.wpm) : result.wpm,
      lastWpm: result.wpm,
      lastAccuracy: result.accuracy,
      lastTime: result.timeSeconds,
      completedAt: new Date().toISOString(),
      timesCompleted: prev ? prev.timesCompleted + 1 : 1,
    };
    localStorage.setItem(this.KEY, JSON.stringify(all));
  }

  clear(): void {
    localStorage.removeItem(this.KEY);
  }
}
