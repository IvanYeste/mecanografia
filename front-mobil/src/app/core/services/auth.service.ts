import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

interface AuthResponse {
  access_token: string;
  token_type: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly TOKEN_KEY = 'auth_token';
  readonly apiUrl = 'https://mecanografia-back.onrender.com';

  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/register`, { email, password })
      .pipe(tap((res) => localStorage.setItem(this.TOKEN_KEY, res.access_token)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(tap((res) => localStorage.setItem(this.TOKEN_KEY, res.access_token)));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.router.navigateByUrl('/login');
  }
}
