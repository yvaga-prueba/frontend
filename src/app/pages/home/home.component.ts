import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent {
  
  // === HISTORIAS DESTACADAS (HIGHLIGHTS) ===
  
   stories = [
    { 
      name: 'Nuevos Ingresos', 
      img: 'assets/nuevosIngresos.png', 
      link: '/products', 
      queryParams: { filter: 'new' } 
    },
    { 
      name: 'Ofertas', 
      img: 'assets/ofertas.png', 
      link: '/products', 
      queryParams: { filter: 'ofertas' } 
    },
    { 
      name: 'Mujeres', 
      img: 'assets/mujeres.png', 
      link: '/products', 
      queryParams: { gender: 'Mujer' } 
    },
    { 
      name: 'Línea Negra', 
      img: 'assets/lineaNegra.png', 
      link: '/products', 
      queryParams: { color: 'Negro' } 
    },
    { 
      name: 'Hombres', 
      img: 'assets/hombres.png', 
      link: '/products', 
      queryParams: { gender: 'Hombre' } 
    }
  ];
}