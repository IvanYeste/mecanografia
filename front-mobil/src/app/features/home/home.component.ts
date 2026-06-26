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

  selectMode = false;
  selected = new Set<number>();
  markingLoading = false;

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

  get selectedCount(): number {
    return this.selected.size;
  }

  get selectedNewCount(): number {
    return Array.from(this.selected).filter((id) => !this.progress[id]).length;
  }

  setFilter(f: Filter): void {
    this.filter = f;
  }

  onCardClick(id: number): void {
    if (this.selectMode) {
      this.toggleSelect(id);
    } else {
      this.router.navigate(['/lesson', id]);
    }
  }

  getProgress(id: number): LessonProgress | null {
    return this.progress[id] ?? null;
  }

  isSelected(id: number): boolean {
    return this.selected.has(id);
  }

  toggleSelectMode(): void {
    this.selectMode = !this.selectMode;
    if (!this.selectMode) this.selected.clear();
  }

  toggleSelect(id: number): void {
    if (this.selected.has(id)) {
      this.selected.delete(id);
    } else {
      this.selected.add(id);
    }
  }

  selectPending(): void {
    this.filteredLessons
      .filter((l) => !this.progress[l.id])
      .forEach((l) => this.selected.add(l.id));
  }

  selectAll(): void {
    this.filteredLessons.forEach((l) => this.selected.add(l.id));
  }

  clearSelection(): void {
    this.selected.clear();
  }

  markSelectedCompleted(): void {
    const ids = Array.from(this.selected).filter((id) => !this.progress[id]);
    if (ids.length === 0) {
      this.selected.clear();
      this.selectMode = false;
      return;
    }
    this.markingLoading = true;
    forkJoin(
      ids.map((id) =>
        this.progressService.save(id, { wpm: 0, accuracy: 100, timeSeconds: 0, errors: 0 }),
      ),
    ).subscribe(() => {
      this.progress = this.progressService.getAll();
      this.selected.clear();
      this.selectMode = false;
      this.markingLoading = false;
    });
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
