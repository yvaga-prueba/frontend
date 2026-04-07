import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SizeGuide {
  id?: number;
  category: string;
  size: string;
  min_weight: number;
  max_weight: number;
  min_height: number;
  max_height: number;
  chest_cm: number;
  waist_cm: number;
  hip_cm: number;
  length_cm: number;
}

@Injectable({ providedIn: 'root' })
export class SizeGuideService {
  private readonly baseUrl = `${environment.apiUrl}/size-guides`;

  constructor(private http: HttpClient) {}

  // Busca guías por categoría (Ej: 'Remeras') - Para el cliente
  getGuidesByCategory(category: string): Observable<SizeGuide[]> {
    return this.http.get<SizeGuide[]>(`${this.baseUrl}/${category}`);
  }

  // Trae todas las guías - Para el Admin
  getAllGuides(): Observable<SizeGuide[]> {
    return this.http.get<SizeGuide[]>(this.baseUrl);
  }

  // Crea una nueva regla
  createGuide(guide: SizeGuide): Observable<SizeGuide> {
    return this.http.post<SizeGuide>(this.baseUrl, guide);
  }

  updateGuide(id: number, guide: SizeGuide): Observable<SizeGuide> {
    return this.http.put<SizeGuide>(`${this.baseUrl}/${id}`, guide);
  }

  // Borra una regla
  deleteGuide(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}