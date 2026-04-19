import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  currentYear: number = new Date().getFullYear();

  isLoggedIn = computed(() => this.authService.currentUser() !== null);

  constructor(private authService: AuthService) {}

  // Atajamos el formulario del Newsletter
  subscribe(event: Event) {
    event.preventDefault();
    alert('¡Bienvenido al club YVAGA! Pronto recibirás novedades exclusivas.');
  }
}