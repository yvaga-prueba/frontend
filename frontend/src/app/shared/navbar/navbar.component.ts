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

  // TUS MENSAJES ORIGINALES
  messages: string[] = [
    'ENVÍOS GRATIS A PARTIR DE $150.000 🚚',
    '3 Y 6 CUOTAS SIN INTERÉS 💳',
    'NUEVA COLECCIÓN YVAGA 2025 ✨',
  ];

  // TRUCO: Repetimos la lista 30 veces para crear una cinta "infinita"
  // Y usamos " / " como separador en lugar del punto
  tickerText: string = Array(30).fill(this.messages).flat().join('   /   ');

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      this.isScrolled = window.scrollY > 50;
    }
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }
}
