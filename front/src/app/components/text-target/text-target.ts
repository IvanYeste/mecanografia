import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

type CharState = 'pending' | 'correct' | 'wrong';
type TokKind = 'space' | 'word' | 'newline';

type Token = {
  kind: TokKind;
  text: string;
  start: number;
};

@Component({
  selector: 'app-text-target',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './text-target.html',
  styleUrl: './text-target.scss',
})
export class TextTargetComponent implements OnChanges {
  @Input() target = '';
  @Input() typed = '';
  @Input() caretIndex = 0;
  @Input() wrongAt: number | null = null;
  @Input() flashWrong = false;

  tokens: Token[] = [];

  ngOnChanges(_changes: SimpleChanges): void {
    this.tokens = this.buildTokens(this.target ?? '');
  }

  private buildTokens(s: string): Token[] {
    const parts = s.match(/\n|[^\S\n]+|\S+/g) ?? [];
    let pos = 0;

    return parts.map((p): Token => {
      let kind: TokKind = 'word';
      if (p === '\n') kind = 'newline';
      else if (/^[^\S\n]+$/.test(p)) kind = 'space';

      const tok: Token = { kind, text: p, start: pos };
      pos += p.length;
      return tok;
    });
  }

  getCharState(globalIndex: number): CharState {
    // ✅ si el componente padre ha marcado error en esta posición, manda sobre todo
    if (this.wrongAt === globalIndex) return 'wrong';

    const t = this.typed?.[globalIndex];
    const c = this.target?.[globalIndex];
    if (t === undefined) return 'pending';
    return t === c ? 'correct' : 'wrong';
  }
  isCaret(globalIndex: number): boolean {
    return globalIndex === this.caretIndex;
  }
  toChars(s: string): string[] {
    return Array.from(s ?? '');
  }
  isCaretGap(globalIndex: number): boolean {
    // caret está en un "hueco": o bien al final del texto, o bien justo antes de un \n
    return (
      globalIndex === this.caretIndex &&
      (this.target?.[globalIndex] === '\n' || globalIndex >= this.target.length)
    );
  }
}
