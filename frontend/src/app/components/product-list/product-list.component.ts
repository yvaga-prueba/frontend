import { Component, OnInit } from '@angular/core';
import { Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {
  products: Product[] = [];
  loading = false;
  error: string | null = null;

  // filtros (opcionales)
  category = '';
  size = '';
  search = '';

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;

    this.productService.getProducts({
      category: this.category || undefined,
      size: this.size || undefined,
      q: this.search || undefined,
      limit: 20,
      offset: 0
    }).subscribe({
      next: (res) => {
        this.products = res.products;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Error al cargar productos';
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.loadProducts();
  }
}