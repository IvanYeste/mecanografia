import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { LessonService } from '../../core/services/lesson.service';
import { Lesson } from '../../core/models/lesson.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private lessonService = inject(LessonService);
  private router = inject(Router);

  lessons: Lesson[] = [];
  loading = true;
  error = false;

  ngOnInit(): void {
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
}
