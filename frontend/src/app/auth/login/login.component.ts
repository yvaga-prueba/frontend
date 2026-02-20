import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['../auth.styles.css', './login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMsg = '';
  loading = false;
  showPassword = false;

  constructor(private authService: AuthService, private router: Router) { }

  login() {
    this.errorMsg = '';
    this.loading = true;
    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Credenciales incorrectas. Volvé a intentar.';
        this.loading = false;
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}