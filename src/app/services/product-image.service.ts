import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProductImage {
    id: number;
    product_id: number;
    url: string;
    is_primary: boolean;
    position: number;
    created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ProductImageService {
    private http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/products`;

    getImages(productId: number): Observable<ProductImage[]> {
        return this.http.get<ProductImage[]>(`${this.base}/${productId}/images`);
    }

    uploadImage(productId: number, file: File, isPrimary: boolean, position: number): Observable<ProductImage> {
        const form = new FormData();
        form.append('file', file);
        form.append('is_primary', String(isPrimary));
        form.append('position', String(position));
        return this.http.post<ProductImage>(`${this.base}/${productId}/images`, form);
    }

    deleteImage(productId: number, imageId: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/${productId}/images/${imageId}`);
    }

    reorderImages(productId: number, imageIds: number[]): Observable<void> {
        return this.http.put<void>(`${this.base}/${productId}/images/reorder`, { image_ids: imageIds });
    }
}
