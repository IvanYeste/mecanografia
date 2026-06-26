import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'lesson/:id',
    loadComponent: () =>
      import('./features/typing/typing.component').then((m) => m.TypingComponent),
    canActivate: [authGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/register/register.component').then((m) => m.RegisterComponent),
  },
  { path: '**', redirectTo: '' },
];
