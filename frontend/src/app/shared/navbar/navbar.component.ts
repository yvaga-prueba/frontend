import { Component, HostListener, Inject, PLATFORM_ID, computed, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

/** Rutas donde el fondo de página es claro → forzar navbar en modo oscuro (texto negro) */
const LIGHT_BG_ROUTES = ['/perfil', '/cart', '/checkout'];

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

  messages: string[] = [
    'ENVÍOS GRATIS A PARTIR DE $150.000 🚚',
    '3 Y 6 CUOTAS SIN INTERÉS 💳',
    'NUEVA COLECCIÓN YVAGA 2026 ✨',
  ];

  tickerText: string = Array(40).fill(this.messages).flat().join('   /   ');

  // Estado reactivo de autenticación
  currentUser = computed(() => this.authService.currentUser());
  isLoggedIn = computed(() => this.authService.isLoggedIn());

  // Fuerza colores oscuros en páginas con fondo claro
  private _forceDark = signal(false);
  forceDark = this._forceDark.asReadonly();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router
  ) {
    // Setear estado inicial (por si se navega directamente a la ruta)
    this._forceDark.set(this.isLightBgRoute(this.router.url));

    // Actualizar en cada navegación
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => {
        this._forceDark.set(this.isLightBgRoute((e as NavigationEnd).urlAfterRedirects));
      });
  }

  private isLightBgRoute(url: string): boolean {
    return LIGHT_BG_ROUTES.some(route => url.startsWith(route));
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      this.isScrolled = window.scrollY > 50;
    }
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.isMenuOpen ? 'hidden' : 'auto';
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  goToPerfil() {
    this.router.navigate(['/perfil']);
  }
}