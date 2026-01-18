import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  isScrolled = false;
  isMenuOpen = false;

  // MENSAJES ORIGINALES
  messages: string[] = [
    'ENVÍOS GRATIS A PARTIR DE $150.000 🚚',
    '3 Y 6 CUOTAS SIN INTERÉS 💳',
    'NUEVA COLECCIÓN YVAGA 2026 ✨',
  ];

  // TRUCO ORIGINAL: Repetimos la lista 40 veces
  tickerText: string = Array(40).fill(this.messages).flat().join('   /   ');

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      // Si baja más de 50px, cambia a blanco y muestra el menú
      this.isScrolled = window.scrollY > 50;
    }
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    // Bloquear scroll de fondo si quieres (opcional)
    if (isPlatformBrowser(this.platformId)) {
        document.body.style.overflow = this.isMenuOpen ? 'hidden' : 'auto';
    }
  }
}