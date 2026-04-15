import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SizeGuide {
  id?: number;
  category: string;
  fit_type: string;   
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

  
  getGuidesByCategory(category: string, fitType?: string): Observable<SizeGuide[]> {
    let params = new HttpParams();
    
    
    if (fitType) {
      params = params.set('fit_type', fitType);
    }

    return this.http.get<SizeGuide[]>(`${this.baseUrl}/${category}`, { params });
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