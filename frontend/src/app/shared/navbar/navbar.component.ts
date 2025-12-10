import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common'; // Importamos isPlatformBrowser
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isScrolled = false;
  isMenuOpen = false;

  messages: string[] = [
    'ENVÍOS GRATIS A PARTIR DE $150.000 🚚',
    '3 Y 6 CUOTAS SIN INTERÉS 💳',
    'NUEVA COLECCIÓN YVAGA 2025 ✨',
  ];
  currentMessage = this.messages[0];
  private intervalId: any;

  // Inyectamos el identificador de la plataforma para saber si estamos en navegador o servidor
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    // CORRECCIÓN CLAVE: Solo iniciamos el intervalo si estamos en el NAVEGADOR
    if (isPlatformBrowser(this.platformId)) {
      this.startMessageRotation();
    }
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  startMessageRotation() {
    this.intervalId = setInterval(() => {
      // Lógica para rotar mensaje
      const currentIndex = this.messages.indexOf(this.currentMessage);
      const nextIndex = (currentIndex + 1) % this.messages.length;
      this.currentMessage = this.messages[nextIndex];
    }, 3500);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    // El scroll solo existe en el navegador, así que verificamos también
    if (isPlatformBrowser(this.platformId)) {
      this.isScrolled = window.scrollY > 50;
    }
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }
}
