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