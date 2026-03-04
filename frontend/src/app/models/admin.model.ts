import { TicketStatus, PaymentMethod } from '../services/ticket.service';

/** * Interfaz para los ítems de una venta. 
 * Mapea directamente con TicketLine del backend.
 */
export interface SaleItem {
  id: number;
  product_id: number;
  name: string; // En el back es product_title
  price: number; // En el back es unit_price
  quantity: number;
  category: string;
  subtotal: number;
}

/** * Interfaz principal de Venta/Ticket para el Super Admin.
 * Combina datos de Ticket y detalles adicionales de envío.
 */
export interface SaleDetail {
  id: number;
  date: Date; // Basado en created_at del backend
  ticket_number: string;
  customerName: string; // Se obtendrá del user_id o notas
  total: number;
  subtotal: number;
  status: TicketStatus; 
  paymentStatus: 'Pagado' | 'Impago'; // Calculado: paid si status es 'paid' o 'completed'
  paymentMethod: PaymentMethod;
  items: SaleItem[];
  seller: string;
  discountCode: string;
  discountAmount: number;
  address?: string;
  trackingNumber?: string;
  // Campos para etiquetas de envío (se pueden guardar en 'notes' como JSON o campos extra)
  dni?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  phone?: string;
  notes?: string;
}

/** * Interfaz para las métricas del Dashboard.
 */
export interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  salesGrowth: number;
  ticketGrowth: number;
  paymentMethods: {
    efectivo: number;
    transferencia: number;
    tarjeta: number;
  };
  discounts: {
    totalAmount: number;
    impactPercent: number;
  };
  categoryStats: {
    label: string;
    percent: number;
  }[];
}

/**
 * Interfaz para gestión de Usuarios/Equipo.
 */
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'seller' | 'superadmin' | 'user';
  sales: number;
  commission: number;
}

export interface Activity {
  id: number;
  date: Date;
  action: string;
  details: string;
  user: string;
}