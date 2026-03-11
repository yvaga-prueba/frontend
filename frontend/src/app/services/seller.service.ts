import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface Seller {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  coupon_code: string;
  discount_percentage: number;
  is_active: boolean;
  created_at?: string;
}

export interface CreateSellerRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  coupon_code: string;
  discount_percentage: number;
}

export interface UpdateSellerRequest extends CreateSellerRequest {
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SellerService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/sellers';

  getSellers(): Observable<Seller[]> {
    return this.http.get<Seller[]>(this.apiUrl);
  }

  createSeller(seller: CreateSellerRequest): Observable<any> {
    return this.http.post(this.apiUrl, seller);
  }

  updateSeller(id: number, seller: UpdateSellerRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, seller);
  }
}