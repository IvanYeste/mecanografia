import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LessonService, Lesson } from '../../core/lesson.service';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lessons-select',
  standalone: true,
  imports: [CommonModule, FormsModule],

  templateUrl: './lesson-select.html',
  styleUrls: ['./lesson-select.scss'],
})
export class LessonsSelectComponent {
  readonly STORAGE_KEY = 'typing_progress_v1';
  completedCount = 0;
  totalCount = 0;

  lessons$!: Observable<Lesson[]>;
  progress = this.loadProgress();

  constructor(private lessonService: LessonService, private router: Router) {
    this.lessons$ = this.lessonService.getLessons().pipe(
      map((lessons) => {
        const arr = lessons ?? [];

        this.totalCount = arr.length;
        this.completedCount = arr.reduce((acc, l) => acc + (this.isCompleted(l.id) ? 1 : 0), 0);

        // si usas filtro/buscador
        this.filteredLessons = arr;
        this.applyFilter(arr);

        return arr;
      }),
      shareReplay(1),
      catchError((err) => {
        console.error(err);
        this.totalCount = 0;
        this.completedCount = 0;
        this.filteredLessons = [];
        return of([] as Lesson[]);
      })
    );
  }

  private loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
    } catch {
      localStorage.removeItem(this.STORAGE_KEY);
      return {};
    }
  }

  isCompleted(id: number): boolean {
    return this.progress[id]?.completed === true;
  }

  openLesson(id: number): void {
    this.router.navigate(['/typing'], { queryParams: { lessonId: id } });
  }

  lessonPreview(text: string): string {
    const t = (text ?? '').replace(/\s+/g, ' ').trim();
    return t.length > 42 ? t.slice(0, 42) + '…' : t;
  }

  resetProgress(): void {
    if (!confirm('¿Seguro que quieres borrar el progreso?')) return;
    localStorage.removeItem(this.STORAGE_KEY);
    this.progress = {};
  }

  continue(lessons: Lesson[]): void {
    const next = lessons.find((l) => !this.isCompleted(l.id));
    this.openLesson(next ? next.id : lessons[0]?.id ?? 0);
  }
  query = '';
  statusFilter: 'all' | 'pending' | 'done' = 'all';
  filteredLessons: Lesson[] = [];

  private initFilter(lessons: Lesson[]) {
    this.filteredLessons = lessons;
    this.applyFilter(lessons);
  }

  applyFilter(lessons: Lesson[]) {
    const q = this.query.trim().toLowerCase();

    this.filteredLessons = lessons.filter((l) => {
      const done = this.isCompleted(l.id);
      if (this.statusFilter === 'done' && !done) return false;
      if (this.statusFilter === 'pending' && done) return false;

      if (!q) return true;
      return (l.text ?? '').toLowerCase().includes(q);
    });
  }

  setStatus(s: 'all' | 'pending' | 'done', lessons: Lesson[]) {
    this.statusFilter = s;
    this.applyFilter(lessons);
  }

  copyPreview(text: string) {
    const t = (text ?? '').slice(0, 250);
    navigator.clipboard?.writeText(t);
  }
}
