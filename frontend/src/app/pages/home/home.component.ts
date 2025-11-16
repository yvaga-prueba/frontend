import { Component, OnInit } from '@angular/core';
import { Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  imports: [
    CommonModule,  // pipes (number, date, etc.)
    FormsModule    // ngModel
  ]
})
export class HomeComponent implements OnInit {
  products: Product[] = [];
  loading = false;
  error: string | null = null;

  // Filtros
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
      limit: 50,
      offset: 0
    }).subscribe({
      next: (res) => {
        this.products = res.products || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.error = 'Error al cargar los productos';
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.loadProducts();
  }

  clearFilters(): void {
    this.category = '';
    this.size = '';
    this.search = '';
    this.loadProducts();
  }

  addToCart(product: Product): void {
    console.log('Agregando al carrito:', product);
    // Aquí implementarás la lógica del carrito más adelante
    alert(`${product.title} agregado al carrito`);
  }
}

