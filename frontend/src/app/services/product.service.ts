import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductListResponse } from '../models/product.model';
import { environment } from '../../environments/environment';

export interface ProductFilter {
  category?: string;
  size?: string;
  q?: string;
  num?: number;
  cursor?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly baseUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) { }

  getProducts(filter: ProductFilter = {}): Observable<ProductListResponse> {
    let params = new HttpParams();
    if (filter.category) params = params.set('category', filter.category);
    if (filter.size) params = params.set('size', filter.size);
    if (filter.q) params = params.set('q', filter.q);
    if (filter.num) params = params.set('num', filter.num.toString());
    if (filter.cursor) params = params.set('cursor', filter.cursor);
    return this.http.get<ProductListResponse>(this.baseUrl, { params });
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }
}