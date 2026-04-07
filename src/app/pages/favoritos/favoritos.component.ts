import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FavoriteService } from '../../services/favorite.service';
import { ProductListComponent } from '../../components/product-list/product-list.component';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductListComponent],
  templateUrl: './favoritos.component.html',
  styleUrls: ['./favoritos.component.css']
})
export class FavoritosComponent implements OnInit {
  // Inyectamos el servicio
  favoriteSvc = inject(FavoriteService);
  
  // Traemos la lista de favoritos 
  favorites = this.favoriteSvc.favorites;

  ngOnInit() {
    // Al entrar a la página, le decimos a Go que nos traiga lo último guardado
    this.favoriteSvc.loadFavorites();
  }
}