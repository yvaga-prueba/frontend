import { Component, HostListener, Inject, PLATFORM_ID, computed, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { Subject } from 'rxjs';
import { filter, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FavoriteService } from '../../services/favorite.service'; 


const LIGHT_BG_ROUTES = ['/perfil', '/cart', '/checkout', '/admin', '/products', '/favoritos'];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit { 
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
  isAdmin = computed(() => this.authService.currentUser()?.role === 'admin');

  // Badge del carrito
  cartCount = computed(() => this.cart.totalUnits());

  // Badge del corazón ===
  favCount = computed(() => this.favoriteSvc.favoritesCount());

  // Fuerza colores oscuros en páginas con fondo claro
  private _forceDark = signal(false);
  forceDark = this._forceDark.asReadonly();

  // El Subject para la búsqueda en tiempo real
  private searchSubject = new Subject<string>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    public cart: CartService,
    private router: Router,
    private favoriteSvc: FavoriteService 
  ) {
    // Setear estado inicial (por si se navega directamente a la ruta)
    this._forceDark.set(this.isLightBgRoute(this.router.url));

    // Actualizar en cada navegación
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => {
        this._forceDark.set(this.isLightBgRoute((e as NavigationEnd).urlAfterRedirects));
      });

    // escucha el buscador y pone un retraso de 300 ms
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.router.navigate(['/products'], {
        queryParams: { q: query || null },
        queryParamsHandling: 'merge'
      });
    });
  }

  //Se ejecuta al cargar el Navbar 
  ngOnInit() {
    // Si el usuario ya está logueado cuando entra a la página, cargamos sus favoritos
    if (this.isLoggedIn()) {
      this.favoriteSvc.loadFavorites();
    }
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
    this.favoriteSvc.loadFavorites(); 
    this.router.navigate(['/']);
  }

  goToPerfil() {
    this.router.navigate(['/perfil']);
  }

  onGlobalSearch(event: any) {
    const query = event.target.value.trim();
    this.searchSubject.next(query);
  }
}