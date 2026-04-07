import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductListResponse } from '../models/product.model';
import { environment } from '../../environments/environment';

// Interfaz para tipar los filtros que le mando al backend. Siempre es mejor tener todo tipado en TS.
export interface ProductFilter {
  category?: string;
  size?: string;
  q?: string;
  num?: number;
  cursor?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  // Me traigo la URL base de los environments para no tenerla hardcodeada por todos lados
  private readonly baseUrl = `${environment.apiUrl}/products`;

  // Inyecto el HttpClient para poder hacer las peticiones al backend en Go
  constructor(private http: HttpClient) { }

  getProducts(filter: ProductFilter = {}): Observable<ProductListResponse> {
    // Armo los query params dinámicamente según los filtros que el usuario haya seleccionado
    let params = new HttpParams();
    if (filter.category) params = params.set('category', filter.category);
    if (filter.size) params = params.set('size', filter.size);
    if (filter.q) params = params.set('q', filter.q);
    if (filter.num) params = params.set('num', filter.num.toString());
    if (filter.cursor) params = params.set('cursor', filter.cursor);
    
    // Le pego al endpoint principal del catálogo
    return this.http.get<ProductListResponse>(this.baseUrl, { params });
  }

  getProductById(id: number): Observable<Product> {
    // Traigo la data de un solo producto puntual
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  getProductVariants(id: number): Observable<Product[]> {
    // Traigo todos los "hermanos" de este producto (mismo modelo pero distintos talles/colores)
    return this.http.get<Product[]>(`${this.baseUrl}/${id}/variants`);
  }

  // Busca 4 productos de la misma categoría excluyendo el que ya estamos viendo
  getRelatedProducts(category: string, excludeProductId: number): Observable<Product[]> {
    const params = new HttpParams()
      .set('category', category)
      .set('exclude_id', excludeProductId.toString())
      .set('limit', '4');

    return this.http.get<Product[]>(`${this.baseUrl}/related`, { params });
  }
}