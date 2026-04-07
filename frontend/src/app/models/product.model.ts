import { environment } from '../../environments/environment';

export interface Product {
  id: number;
  bar_code?: number;
  title: string;
  description: string;
  /** unit_price del backend; price como alias de compatibilidad */
  unit_price?: number;
  price?: number;
  category: string;
  size: string;
  color?: string;
  gender: string;
  stock: number;
  created_at?: string;
  updated_at?: string;
  /** URL de imagen principal (opcional) */
  image_url?: string;
}

export interface ProductListResponse {
  products: Product[];
  next_cursor?: string;
}

/** Devuelve el precio del producto independiente del campo que use el backend */
export function productPrice(p: Product): number {
  return p.unit_price ?? p.price ?? 0;
}

/** 
 * Resuelve la URL de una imagen teniendo en cuenta su origen.
 * Si es una URL de backend (empieza con /api), le antepone el host 
 * adecuado según el ambiente configurado (desarrollo/producción).
 */
export function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;

  // Reemplaza el prefijo original /api/ por la baseUrl del environment configurado
  if (url.startsWith('/api/')) {
    // environment.apiUrl típicamente es "http://localhost:8080/api"
    // Removemos "/api" de url para evitar "http://localhost:8080/api/api/..."
    return environment.apiUrl + url.substring(4);
  }
  return url;
}
