export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  size: string;
  stock: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductListResponse {
  products: Product[];
  next_cursor?: string;
}