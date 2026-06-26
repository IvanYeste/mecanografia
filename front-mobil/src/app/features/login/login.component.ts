import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgIf, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  error = '';
  loading = false;

  submit(): void {
    this.error = '';
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.error = err.error?.detail ?? 'Error al iniciar sesión';
        this.loading = false;
      },
    });
  }
}
