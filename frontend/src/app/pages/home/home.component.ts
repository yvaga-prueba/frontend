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
      name: 'NUEVOS INGRESOS', 
      // Foto: Modelo urbano con estilo, fondo neutro
      img: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'new' 
    },
    { 
      name: 'OFERTAS', 
      // Foto: Bolsas de compra o etiqueta roja/llamativa
      img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'sale'
    },
    { 
      name: 'HOT SALE', 
      // Foto: Estilo fuego/urbano dinámico
      img: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'best'
    },
    { 
      name: 'LINEA NEGRA', 
      // Foto: Outfit "All Black" estética oscura
      img: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'black'
    },
    { 
      name: 'GORRAS', 
      // Foto: Primer plano de gorra/cap
      img: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'urban'
    }
  ];
}