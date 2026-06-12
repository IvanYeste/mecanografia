import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'lesson/:id',
    loadComponent: () =>
      import('./features/typing/typing.component').then(
        (m) => m.TypingComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
