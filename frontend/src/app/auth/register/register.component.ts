import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  name = ''; email = ''; password = '';
  constructor(private router: Router) {}
  register() {
    // Mock registro + login
    localStorage.setItem('token', 'demo');
    this.router.navigate(['/mensualidad']);
  }
}