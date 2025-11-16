import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  email = '';
  password = '';
  constructor(private router: Router) {}
  login() {
    // Mock login: guardá un token para habilitar Mensualidad
    localStorage.setItem('token', 'demo');
    this.router.navigate(['/mensualidad']);
  }
}