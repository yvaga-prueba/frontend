import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Product } from '../models/product.model';
import { AuthService } from './auth.service'; 
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private http = inject(HttpClient);
  private authSvc = inject(AuthService); 
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/favorites`;

  favorites = signal<Product[]>([]);

  favoriteIds = computed(() => {
    const ids = new Set<number>();
    this.favorites().forEach(p => ids.add(p.id));
    return ids;
  });

  favoritesCount = computed(() => this.favorites().length);

  loadFavorites() {
    if (!this.authSvc.isLoggedIn()) {
      this.favorites.set([]); 
      return;
    }

    this.http.get<Product[]>(this.apiUrl).subscribe({
      next: (prods) => this.favorites.set(prods || []),
      error: (err) => {
        console.error('Error cargando favoritos', err);
        if (err.status === 401) {
            this.favorites.set([]);
        }
      }
    });
  }

  toggleFavorite(productId: number) {
    if (!this.authSvc.isLoggedIn()) {
      
      Swal.fire({
        title: '¡Iniciá sesión!',
        text: 'Para armar tu lista de favoritos necesitas estar registrado.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#111111', 
        cancelButtonColor: '#888888', 
        confirmButtonText: 'Ir a Iniciar Sesión',
        cancelButtonText: 'Seguir mirando'
      }).then((result) => {
        if (result.isConfirmed) {
          // Capturamos la URL exacta en la que está parado el usuario ahora mismo
          const currentUrl = this.router.url; 
          
          // Lo mandamos al login, pero le pasamos la URL actual como parámetro
          this.router.navigate(['/auth/login'], { 
            queryParams: { returnUrl: currentUrl } 
          });
        }
      });
      return; // Cortamos acá para que no le pegue al backend
    }

    // Si está logueado, sigue normal
    this.http.post<{is_favorite: boolean}>(`${this.apiUrl}/${productId}`, {}).subscribe({
      next: () => this.loadFavorites(),
      error: (err) => console.error('Error al cambiar favorito', err)
    });
  }

  isFavorite(productId: number): boolean {
    return this.favoriteIds().has(productId);
  }
}