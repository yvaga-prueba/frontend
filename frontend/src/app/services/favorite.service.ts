import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Product } from '../models/product.model';
import { AuthService } from './auth.service'; 

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private http = inject(HttpClient);
  private authSvc = inject(AuthService); 
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
      error: (err) => console.error('Error cargando favoritos', err)
    });
  }

  toggleFavorite(productId: number) {
    
    if (!this.authSvc.isLoggedIn()) {
      alert("¡Tenés que iniciar sesión para guardar favoritos!");
      return;
    }

    this.http.post<{is_favorite: boolean}>(`${this.apiUrl}/${productId}`, {}).subscribe({
      next: () => this.loadFavorites(),
      error: (err) => console.error('Error al cambiar favorito', err)
    });
  }

  isFavorite(productId: number): boolean {
    return this.favoriteIds().has(productId);
  }
}