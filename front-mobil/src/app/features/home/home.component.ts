import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { LessonService } from '../../core/services/lesson.service';
import { ProgressService } from '../../core/services/progress.service';
import { Lesson, LessonProgress } from '../../core/models/lesson.model';

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

  startLesson(id: number): void {
    this.router.navigate(['/lesson', id]);
  }

  getProgress(id: number): LessonProgress | null {
    return this.progress[id] ?? null;
  }
}
