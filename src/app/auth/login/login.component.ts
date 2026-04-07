import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
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

  constructor(private authService: AuthService, private router: Router, private route : ActivatedRoute) { }

  login() {
    this.errorMsg = '';
    this.loading = true;
    this.authService.login({ email: this.email, password: this.password }).subscribe({
    next: (respuesta) => {
      // ahora lee y manda al produc que queria marcar como fav el usuario
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/'; 

      // si no hay nada, manda al inicio 
      this.router.navigateByUrl(returnUrl);
    },
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