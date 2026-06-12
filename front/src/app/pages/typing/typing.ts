import { AfterViewInit, Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { TextTargetComponent } from '../../components/text-target/text-target';
import { LessonService, Lesson } from '../../core/lesson.service';

type LessonProgress = {
  completed: boolean;
  date: string; // ISO
  accuracy: number; // 0-100
  wpm: number; // int
  errors: number; // int  ✅ aquí guardamos attemptErrors
  elapsed: number; // seconds
};

type ProgressMap = Record<number, LessonProgress>;

@Component({
  selector: 'app-typing',
  standalone: true,
  imports: [CommonModule, FormsModule, TextTargetComponent],
  templateUrl: './typing.html',
  styleUrls: ['./typing.scss'],
})
export class TypingComponent implements AfterViewInit, OnInit {
  // ===== Strict mode =====
  strictMode = true;

  // ✅ feedback de error visual
  wrongAt: number | null = null;
  wrongExpected = '';
  wrongTyped = '';
  flashWrong = false;

  // ✅ errores reales (intentos fallidos)
  attemptErrors = 0;
  private lastWrongAt: number | null = null;
  private lastWrongKey = '';
  private lastWrongTime = 0;

  @ViewChild('ta') ta!: ElementRef<HTMLTextAreaElement>;

  // ===== localStorage =====
  private readonly STORAGE_KEY = 'typing_progress_v1';

  // ===== Lessons =====
  lessons: Lesson[] = [];
  index = 0;
  currentLessonId: number | null = null;

  // ===== Target =====
  target = '';
  lines: string[] = [];

  // ===== Typed =====
  typedRaw = '';
  typedAligned = '';
  caretIndex = 0;

  // ===== Stats =====
  elapsed = 0;
  wpm = 0;
  accuracy = 100;

  // ✅ en modo estricto, "errors en texto" suele ser 0, pero lo dejamos por debug/si desactivas strictMode
  errors = 0;

  private timer: any = null;
  private startedAt = 0;

  // ===== Debug =====
  debug = {
    enabled: true,
    lastTag: '',
    rawLen: 0,
    alignedLen: 0,
    targetLen: 0,
    rawIndex: 0,
    targetIndex: 0,
    targetChar: '',
    targetCode: 0,
    rawChar: '',
    rawCode: 0,
    targetAround: '',
    rawAround: '',
  };

  constructor(
    private lessonService: LessonService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.lessonService.getLessons().subscribe({
      next: (data) => {
        this.lessons = data ?? [];
        if (this.lessons.length === 0) {
          this.lessons = [{ id: 0, text: 'No hay lecciones disponibles.' }];
        }

        const lessonIdFromQuery = this.getLessonIdFromQuery();
        if (lessonIdFromQuery !== null) {
          const idx = this.lessons.findIndex((l) => l.id === lessonIdFromQuery);
          this.loadLessonByIndex(idx >= 0 ? idx : 0, false);
        } else {
          const idx = this.getFirstPendingLessonIndex();
          this.loadLessonByIndex(idx, false);
        }
      },
      error: (err) => {
        console.error('Error cargando lecciones:', err);
        this.lessons = [{ id: 0, text: 'Error cargando lecciones (backend caído).' }];
        this.loadLessonByIndex(0, false);
      },
    });

    this.focusInput();
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.focusInput());
  }

  // ============================================================
  // localStorage helpers
  // ============================================================

  private loadProgress(): ProgressMap {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as ProgressMap;
    } catch {
      return {};
    }
  }

  private saveProgress(map: ProgressMap): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(map));
  }

  private getLessonIdFromQuery(): number | null {
    const v = this.route.snapshot.queryParamMap.get('lessonId');
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private getFirstPendingLessonIndex(): number {
    const progress = this.loadProgress();
    const idx = this.lessons.findIndex((l) => !progress[l.id]?.completed);
    return idx >= 0 ? idx : 0;
  }

  getCurrentProgress(): LessonProgress | null {
    if (this.currentLessonId === null) return null;
    const progress = this.loadProgress();
    return progress[this.currentLessonId] ?? null;
  }

  // ============================================================
  // Actions
  // ============================================================

  focusInput(): void {
    const el = this.ta?.nativeElement;
    if (!el) return;
    el.focus();
  }

  reset(): void {
    this.stopTimer();

    this.typedRaw = '';
    this.typedAligned = '';
    this.caretIndex = 0;

    this.elapsed = 0;
    this.wpm = 0;
    this.accuracy = 100;
    this.errors = 0;

    // ✅ reset errores reales y marcado
    this.attemptErrors = 0;
    this.lastWrongAt = null;
    this.lastWrongKey = '';
    this.lastWrongTime = 0;
    this.clearWrong();

    queueMicrotask(() => {
      const el = this.ta?.nativeElement;
      if (el) {
        el.value = '';
        el.setSelectionRange(0, 0);
        el.focus();
      }
      this.dbg('reset');
    });
  }

  prev(): void {
    if (this.index > 0) this.loadLessonByIndex(this.index - 1, true);
  }

  next(): void {
    if (this.isDone()) this.markCompletedAuto();

    if (this.index < this.lessons.length - 1) {
      this.loadLessonByIndex(this.index + 1, true);
    }
  }

  isDone(): boolean {
    return this.typedAligned.length >= this.target.length;
  }

  markDoneManually(): void {
    this.markCompletedAuto(true);
  }

  // ============================================================
  // Input handling
  // ============================================================

  onInput(_valueFromNgModel: string): void {
    const el = this.ta?.nativeElement;
    if (!el) return;

    const raw = el.value;
    const domPos = el.selectionStart ?? raw.length;

    this.typedRaw = raw;
    this.typedAligned = this.normalizeInput(raw);

    const rawBefore = raw.slice(0, domPos);
    this.caretIndex = this.normalizeInput(rawBefore).length;

    if (!this.timer && this.typedRaw.length > 0) this.startTimer();
    this.recalcStats();

    if (this.isDone()) this.markCompletedAuto();

    this.dbg('onInput');
  }

  onKeyDown(e: KeyboardEvent): void {
    if (!this.strictMode) return;
    if (!this.target) return;

    // Permitir combos (Ctrl/Cmd/Alt)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;

    // Permitir teclas de control
    const allowed = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Tab',
    ];

    if (allowed.includes(key)) {
      // si borras, limpia el error visual
      if (key === 'Backspace' || key === 'Delete') this.clearWrong();
      return;
    }

    // Solo caracteres imprimibles o Enter
    const isPrintable = key.length === 1 || key === 'Enter';
    if (!isPrintable) return;

    const typedChar = this.normalizeInput(key === 'Enter' ? '\n' : key);
    const expected = this.target[this.caretIndex] ?? '';

    if (typedChar !== expected) {
      e.preventDefault();

      // ✅ cuenta el fallo real (anti-spam por autorepeat)
      const now = Date.now();
      const sameSpot = this.lastWrongAt === this.caretIndex;
      const sameKey = this.lastWrongKey === typedChar;
      const tooSoon = now - this.lastWrongTime < 120;

      if (!(sameSpot && sameKey && tooSoon)) {
        this.attemptErrors++;
        this.lastWrongAt = this.caretIndex;
        this.lastWrongKey = typedChar;
        this.lastWrongTime = now;
      }

      this.markWrong(this.caretIndex, expected, typedChar);
      this.recalcStats(); // ✅ para actualizar accuracy al momento
      return;
    }

    this.clearWrong();
  }

  onPaste(e: ClipboardEvent): void {
    if (!this.strictMode) return;
    e.preventDefault();
  }

  // ============================================================
  // Lesson loading
  // ============================================================

  private loadLessonByIndex(i: number, syncUrl: boolean): void {
    this.index = Math.max(0, Math.min(i, this.lessons.length - 1));

    const lesson = this.lessons[this.index];
    this.currentLessonId = lesson?.id ?? null;

    this.target = this.normalizeInput(lesson?.text ?? '');
    this.lines = this.target.split('\n');

    this.typedRaw = '';
    this.typedAligned = '';
    this.caretIndex = 0;

    this.stopTimer();
    this.elapsed = 0;
    this.wpm = 0;
    this.accuracy = 100;
    this.errors = 0;

    // ✅ reset errores reales y marcado al cambiar lección
    this.attemptErrors = 0;
    this.lastWrongAt = null;
    this.lastWrongKey = '';
    this.lastWrongTime = 0;
    this.clearWrong();

    if (syncUrl && this.currentLessonId !== null) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { lessonId: this.currentLessonId },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    queueMicrotask(() => {
      const el = this.ta?.nativeElement;
      if (el) {
        el.value = '';
        el.setSelectionRange(0, 0);
      }
      this.focusInput();
      this.dbg('loadLesson');
    });
  }

  // ============================================================
  // Guardado de progreso
  // ============================================================

  private markCompletedAuto(force = false): void {
    if (this.currentLessonId === null) return;

    if (!force && this.typedAligned.length === 0) return;
    if (!force && !this.isDone()) return;

    const progress = this.loadProgress();
    const already = progress[this.currentLessonId]?.completed === true;

    if (already && !force) return;

    progress[this.currentLessonId] = {
      completed: true,
      date: new Date().toISOString(),
      accuracy: this.accuracy,
      wpm: this.wpm,
      errors: this.attemptErrors, // ✅ errores REALES
      elapsed: this.elapsed,
    };

    this.saveProgress(progress);
  }

  // ============================================================
  // Stats
  // ============================================================

  private startTimer(): void {
    this.startedAt = Date.now();
    this.timer = setInterval(() => {
      this.elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
      this.recalcStats();
    }, 250);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.startedAt = 0;
  }

  private recalcStats(): void {
    // --- errores en texto (si strictMode=false te sirve) ---
    let errsInText = 0;
    const n = Math.min(this.typedAligned.length, this.target.length);
    for (let i = 0; i < n; i++) {
      if (this.typedAligned[i] !== this.target[i]) errsInText++;
    }
    this.errors = errsInText;

    // --- accuracy REAL: correctos / (correctos + intentos fallidos) ---
    const correctTyped = this.typedAligned.length; // en estricto, todo lo escrito es correcto
    const totalAttempts = correctTyped + this.attemptErrors;

    this.accuracy =
      totalAttempts === 0 ? 100 : Math.max(0, Math.round((correctTyped / totalAttempts) * 100));

    // --- WPM: basado en caracteres correctos (lo que realmente has avanzado) ---
    const minutes = this.elapsed > 0 ? this.elapsed / 60 : 0;
    const grossWords = correctTyped / 5;
    this.wpm = minutes > 0 ? Math.max(0, Math.round(grossWords / minutes)) : 0;
  }

  // ============================================================
  // Normalización input
  // ============================================================

  private normalizeInput(s: string): string {
    return (s ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '')
      .replace(/[\u2014\u2013]/g, '-') // — y – -> -
      .replace(/\u00AD/g, '');
  }

  // ============================================================
  // Error visual helpers
  // ============================================================

  private markWrong(at: number, expected: string, typed: string): void {
    this.wrongAt = at;
    this.wrongExpected = expected;
    this.wrongTyped = typed;

    this.flashWrong = true;
    setTimeout(() => (this.flashWrong = false), 140);
  }

  private clearWrong(): void {
    this.wrongAt = null;
    this.wrongExpected = '';
    this.wrongTyped = '';
  }

  // ============================================================
  // Debug
  // ============================================================

  private dbg(tag: string): void {
    if (!this.debug.enabled) return;

    const el = this.ta?.nativeElement;
    const raw = el?.value ?? this.typedRaw;
    const domPos = el?.selectionStart ?? raw.length;

    const gi = this.normalizeInput(raw.slice(0, domPos)).length;

    const targetChar = gi < this.target.length ? this.target[gi] : '∅';
    const rawChar = domPos < raw.length ? raw[domPos] : '∅';

    const around = (s: string, idx: number, r = 12) => {
      const a = Math.max(0, idx - r);
      const b = Math.min(s.length, idx + r);
      return s.slice(a, b).replace(/\n/g, '␤').replace(/\r/g, '␍').replace(/\t/g, '⇥');
    };

    this.debug.lastTag = tag;
    this.debug.rawLen = raw.length;
    this.debug.alignedLen = this.typedAligned.length;
    this.debug.targetLen = this.target.length;

    this.debug.rawIndex = domPos;
    this.debug.targetIndex = gi;

    this.debug.targetChar = targetChar === '\n' ? '␤' : targetChar;
    this.debug.targetCode = targetChar === '∅' ? 0 : targetChar.charCodeAt(0);

    this.debug.rawChar = rawChar === '\n' ? '␤' : rawChar === '\r' ? '␍' : rawChar;
    this.debug.rawCode = rawChar === '∅' ? 0 : rawChar.charCodeAt(0);

    this.debug.targetAround = around(this.target, gi);
    this.debug.rawAround = around(raw, domPos);
  }

  goToLessons(): void {
    this.router.navigateByUrl('/lessons'); // 👈 ajusta si tu ruta es otra
  }
}
