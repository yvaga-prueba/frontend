import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductListResponse } from '../models/product.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private baseUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  getProducts(params?: {
    category?: string;
    size?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Observable<ProductListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.size) httpParams = httpParams.set('size', params.size);
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.offset != null) httpParams = httpParams.set('offset', params.offset.toString());
    }

    return this.http.get<ProductListResponse>(this.baseUrl, { params: httpParams });
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }
}