import { Component, Input, inject } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product } from '../../models/product.model';
import { FavoriteService } from '../../services/favorite.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent {
  
  @Input() products: Product[] = [];
  
  // Inyectamos el servicio de favoritos
  private favoriteSvc = inject(FavoriteService);

  // Agrupa las tarjetas por título
  get uniqueProducts(): Product[] {
    if (!this.products) return [];
    
    const seen = new Set<string>();
    const filtered: Product[] = [];
    
    for (const p of this.products) {
      const key = p.title.trim().toLowerCase();
      
      // Si el título no está en la lista de vistos, lo agregamos y lo mostramos
      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(p); 
      }
    }
    return filtered;
  }

  toggleFav(event: Event, productId: number) {
    event.preventDefault(); // Evita que la página salte
    event.stopPropagation(); // Evita que te mande al detalle del producto
    this.favoriteSvc.toggleFavorite(productId);
  }

  // Verifica si está pintado
  isFav(productId: number): boolean {
    return this.favoriteSvc.isFavorite(productId);
  }
}