import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Lesson } from '../models/lesson.model';

@Injectable({ providedIn: 'root' })
export class LessonService {
  private http = inject(HttpClient);
  private apiUrl = 'https://mecanografia-back.onrender.com';

  getLessons(): Observable<Lesson[]> {
    return this.http.get<Lesson[]>(`${this.apiUrl}/lessons`).pipe(
      map((lessons) =>
        lessons.map((l) => ({
          ...l,
          title: `Lección ${l.id + 1}`,
        })),
      ),
    );
  }

  getLessonById(id: number): Observable<Lesson> {
    return this.http
      .get<Lesson>(`${this.apiUrl}/lessons/${id}`)
      .pipe(map((l) => ({ ...l, title: `Lección ${l.id + 1}` })));
  }
}
