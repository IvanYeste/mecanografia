import { Routes } from '@angular/router';
import { TypingComponent } from './pages/typing/typing';
import { LessonsSelectComponent } from './components/lesson-select/lesson-select';

export const routes: Routes = [
  { path: '', redirectTo: 'lessons', pathMatch: 'full' },
  { path: 'lessons', component: LessonsSelectComponent },
  { path: 'typing', component: TypingComponent },
];
