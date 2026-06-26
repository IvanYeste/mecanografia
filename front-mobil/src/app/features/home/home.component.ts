import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';

import { LessonService } from '../../core/services/lesson.service';
import { ProgressService } from '../../core/services/progress.service';
import { AuthService } from '../../core/services/auth.service';
import { Lesson, LessonProgress } from '../../core/models/lesson.model';

type Filter = 'all' | 'completed' | 'pending';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  private router = inject(Router);

  lessons: Lesson[] = [];
  progress: Record<number, LessonProgress> = {};
  loading = true;
  error = false;
  filter: Filter = 'all';

  ngOnInit(): void {
    forkJoin({
      lessons: this.lessonService.getLessons(),
      progress: this.progressService.loadAll().pipe(catchError(() => of({}))),
    }).subscribe({
      next: ({ lessons }) => {
        this.lessons = lessons;
        this.progress = this.progressService.getAll();
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  get filteredLessons(): Lesson[] {
    if (this.filter === 'completed')
      return this.lessons.filter((l) => this.progress[l.id]);
    if (this.filter === 'pending')
      return this.lessons.filter((l) => !this.progress[l.id]);
    return this.lessons;
  }

  get completedCount(): number {
    return Object.keys(this.progress).length;
  }

  setFilter(f: Filter): void {
    this.filter = f;
  }

  startLesson(id: number): void {
    this.router.navigate(['/lesson', id]);
  }

  getProgress(id: number): LessonProgress | null {
    return this.progress[id] ?? null;
  }

  markUpTo(n: number): void {
    const saves = [];
    for (let i = 0; i < n; i++) {
      if (!this.progress[i]) {
        saves.push(
          this.progressService.save(i, { wpm: 0, accuracy: 0, timeSeconds: 0, errors: 0 }),
        );
      }
    }
    if (saves.length > 0) {
      forkJoin(saves).subscribe(() => {
        this.progress = this.progressService.getAll();
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
