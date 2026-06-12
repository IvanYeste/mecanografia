import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  HostListener,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { LessonService } from '../../core/services/lesson.service';
import { ProgressService } from '../../core/services/progress.service';
import { Lesson, TypingResult } from '../../core/models/lesson.model';

interface CharState {
  char: string;
  status: 'pending' | 'correct' | 'wrong';
  wave?: boolean;
}

@Component({
  selector: 'app-typing',
  standalone: true,
  imports: [NgFor, NgClass, NgIf],
  templateUrl: './typing.component.html',
  styleUrl: './typing.component.scss',
})
export class TypingComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);

  lesson: Lesson | undefined;
  nextLessonId: number | null = null;
  chars: CharState[] = [];
  currentIndex = 0;

  started = false;
  finished = false;
  celebrating = false;
  result: TypingResult | null = null;

  private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private errors = 0;
  private totalTyped = 0;

  elapsedSeconds = 0;
  wpm = 0;
  accuracy: number | null = null;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.lessonService.getLessonById(id).subscribe({
      next: (lesson) => {
        this.lesson = lesson;
        this.buildChars(lesson.text);
        this.checkNextLesson(lesson.id);
      },
      error: () => this.router.navigate(['/']),
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private checkNextLesson(currentId: number): void {
    this.lessonService.getLessonById(currentId + 1).subscribe({
      next: () => (this.nextLessonId = currentId + 1),
      error: () => (this.nextLessonId = null),
    });
  }

  private buildChars(text: string): void {
    this.chars = text
      .split('')
      .map((char) => ({ char, status: 'pending', wave: false }));
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (this.celebrating) return;

    if (this.finished) {
      if (e.key === 'Enter' && this.nextLessonId !== null) {
        this.goNext();
      }
      return;
    }

    if (e.key === 'Escape') {
      this.goHome();
      return;
    }
    if (e.key.length !== 1 && e.key !== 'Backspace') return;
    e.preventDefault();
    if (e.key === 'Backspace') {
      this.handleBackspace();
      return;
    }

    if (!this.started) {
      this.started = true;
      this.startTime = Date.now();
      this.startTimer();
    }
    this.handleChar(e.key);
  }

  private handleChar(key: string): void {
    if (this.currentIndex >= this.chars.length) return;
    const expected = this.chars[this.currentIndex].char;
    this.totalTyped++;
    this.chars[this.currentIndex].status =
      key === expected ? 'correct' : 'wrong';
    if (key !== expected) this.errors++;
    this.currentIndex++;
    this.updateStats();
    if (this.currentIndex >= this.chars.length) this.finish();
  }

  private handleBackspace(): void {
    if (this.currentIndex === 0) return;
    this.currentIndex--;
    if (this.chars[this.currentIndex].status === 'wrong') this.errors--;
    this.chars[this.currentIndex].status = 'pending';
    this.totalTyped = Math.max(0, this.totalTyped - 1);
    this.updateStats();
  }

  private updateStats(): void {
    const elapsed = (Date.now() - this.startTime) / 1000 / 60;
    this.wpm = elapsed > 0 ? Math.round(this.currentIndex / 5 / elapsed) : 0;
    this.accuracy =
      this.totalTyped > 0
        ? Math.round(((this.totalTyped - this.errors) / this.totalTyped) * 100)
        : null;
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);
      this.updateStats();
    }, 500);
  }

  private stopTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private finish(): void {
    this.stopTimer();
    this.finished = true;
    this.celebrating = true;
    this.elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);
    this.updateStats();

    this.result = {
      wpm: this.wpm,
      accuracy: this.accuracy ?? 100,
      timeSeconds: this.elapsedSeconds,
      errors: this.errors,
    };

    if (this.lesson) {
      this.progressService.save(this.lesson.id, this.result);
    }

    // Animación ola
    this.playWave();
  }

  private playWave(): void {
    const delay = 18;
    this.chars.forEach((_, i) => {
      setTimeout(() => {
        this.chars[i].wave = true;
        setTimeout(() => {
          this.chars[i].wave = false;
          if (i === this.chars.length - 1) {
            this.celebrating = false;
          }
        }, 400);
      }, i * delay);
    });
  }

  get progress(): number {
    return Math.round((this.currentIndex / this.chars.length) * 100);
  }

  restart(): void {
    this.stopTimer();
    this.currentIndex = 0;
    this.errors = 0;
    this.totalTyped = 0;
    this.elapsedSeconds = 0;
    this.wpm = 0;
    this.accuracy = null;
    this.started = false;
    this.finished = false;
    this.celebrating = false;
    this.result = null;
    if (this.lesson) this.buildChars(this.lesson.text);
  }

  goNext(): void {
    if (this.nextLessonId !== null) {
      this.router.navigate(['/lesson', this.nextLessonId]);
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
