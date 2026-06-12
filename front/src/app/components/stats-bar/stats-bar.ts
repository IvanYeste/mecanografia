import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-bar.html',
  styleUrl: './stats-bar.scss',
})
export class StatsBarComponent {
  @Input() wpm = 0;
  @Input() accuracy = 100;
  @Input() errors = 0;
  @Input() elapsedSec = 0;
}
