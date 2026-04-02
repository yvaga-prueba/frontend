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