import { Component, Input } from '@angular/core'; // <--- 1. Importamos 'Input'
import { CommonModule } from '@angular/common';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent {
  // 2. Ponemos la 'antena' (@Input) para recibir los productos filtrados
  // Si no pones @Input(), este componente ignora lo que le manda el Home.
  @Input() products: Product[] = [];
}
