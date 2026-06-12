import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { LessonService } from '../../core/services/lesson.service';
import { ProgressService } from '../../core/services/progress.service';
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
  private router = inject(Router);

  lessons: Lesson[] = [];
  progress: Record<number, LessonProgress> = {};
  loading = true;
  error = false;
  filter: Filter = 'all';

  ngOnInit(): void {
    this.progress = this.progressService.getAll();
    this.lessonService.getLessons().subscribe({
      next: (data) => {
        this.lessons = data;
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
    for (let i = 0; i < n; i++) {
      if (!this.progress[i]) {
        this.progressService.save(i, {
          wpm: 0,
          accuracy: 0,
          timeSeconds: 0,
          errors: 0,
        });
      }
    }
    this.progress = this.progressService.getAll();
  }
}
