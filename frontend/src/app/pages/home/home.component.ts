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
      name: 'NEW IN', 
      img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'new' 
    },
    { 
      name: 'OFERTAS', 
      img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'sale'
    },
    { 
      name: 'BEST', 
      img: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'best'
    },
    { 
      name: 'BLACK', 
      img: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'black'
    },
    { 
      name: 'URBAN', 
      img: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=200&auto=format&fit=crop',
      link: '/products',
      param: 'urban'
    }
  ];
}