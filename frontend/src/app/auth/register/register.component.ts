import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './register.component.html',
  styleUrls: ['../auth.styles.css', './register.component.css']
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  errorMsg = '';
  loading = false;
  showPassword = false;

  constructor(private authService: AuthService, private router: Router) { }

  register() {
    this.errorMsg = '';
    this.loading = true;
    this.authService.register({
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Error al registrarse. Intentá de nuevo.';
        this.loading = false;
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}