import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LessonProgress, TypingResult } from '../models/lesson.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private cache: Record<number, LessonProgress> = {};

  loadAll(): Observable<Record<number, LessonProgress>> {
    return this.http
      .get<Record<number, LessonProgress>>(`${this.auth.apiUrl}/progress`)
      .pipe(tap((data) => (this.cache = data ?? {})));
  }

  getAll(): Record<number, LessonProgress> {
    return this.cache;
  }

  getLesson(lessonId: number): LessonProgress | null {
    return this.cache[lessonId] ?? null;
  }

  save(lessonId: number, result: TypingResult): Observable<{ ok: boolean }> {
    const prev = this.cache[lessonId];
    const progress: LessonProgress = {
      lessonId,
      bestWpm: prev ? Math.max(prev.bestWpm, result.wpm) : result.wpm,
      lastWpm: result.wpm,
      lastAccuracy: result.accuracy,
      lastTime: result.timeSeconds,
      completedAt: new Date().toISOString(),
      timesCompleted: prev ? prev.timesCompleted + 1 : 1,
    };
    this.cache[lessonId] = progress;
    return this.http.post<{ ok: boolean }>(
      `${this.auth.apiUrl}/progress/${lessonId}`,
      progress,
    );
  }

  saveBulk(lessonIds: number[], result: TypingResult): Observable<{ ok: boolean; saved: number }> {
    const completedAt = new Date().toISOString();
    const lessons = lessonIds.map((id) => {
      const prev = this.cache[id];
      const progress: LessonProgress = {
        lessonId: id,
        bestWpm: prev ? Math.max(prev.bestWpm, result.wpm) : result.wpm,
        lastWpm: result.wpm,
        lastAccuracy: result.accuracy,
        lastTime: result.timeSeconds,
        completedAt,
        timesCompleted: prev ? prev.timesCompleted + 1 : 1,
      };
      this.cache[id] = progress;
      return progress;
    });
    return this.http.post<{ ok: boolean; saved: number }>(
      `${this.auth.apiUrl}/progress/bulk`,
      { lessons },
    );
  }

  clear(): Observable<{ ok: boolean }> {
    this.cache = {};
    return this.http.delete<{ ok: boolean }>(`${this.auth.apiUrl}/progress`);
  }
}
