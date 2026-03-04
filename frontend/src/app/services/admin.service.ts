import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket, TicketSummary } from './ticket.service';
import { SaleDetail } from '../models/admin.model';

/* ── Product types ─────────────────────────────────────── */
export interface AdminProduct {
    id: number;
    bar_code: number;
    title: string;
    description: string;
    stock: number;
    size: string;
    category: string;
    unit_price: number;
    image_url?: string;
}

export interface CreateProductPayload {
    bar_code: number;
    title: string;
    description: string;
    stock: number;
    size: string;
    category: string;
    unit_price: number;
}

export interface ProductListResponse {
    products: AdminProduct[];
    next_cursor?: string;
}

/* ── Ticket types (admin) ──────────────────────────────── */
export interface AdminTicketListResponse {
    tickets?: TicketSummary[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
    private http = inject(HttpClient);
    private readonly productsUrl = `${environment.apiUrl}/products`;
    private readonly ticketsUrl = `${environment.apiUrl}/admin/tickets`; 
    
    private _salesHistory: SaleDetail[] = [];

    //  GESTIÓN DE PRODUCTOS 
    

    getProducts(cursor = '', num = 50): Observable<ProductListResponse> {
        let params = new HttpParams().set('num', num.toString());
        if (cursor) params = params.set('cursor', cursor);
        return this.http.get<ProductListResponse>(this.productsUrl, { params });
    }

    createProduct(payload: CreateProductPayload): Observable<AdminProduct> {
        return this.http.post<AdminProduct>(this.productsUrl, payload);
    }

    updateProduct(id: number, payload: Partial<CreateProductPayload>): Observable<AdminProduct> {
        return this.http.put<AdminProduct>(`${this.productsUrl}/${id}`, payload);
    }

    deleteProduct(id: number): Observable<void> {
        return this.http.delete<void>(`${this.productsUrl}/${id}`);
    }

    /** Incrementa el stock de un producto existente */
    addStock(id: number, quantity: number): Observable<AdminProduct> {
        return this.http.post<AdminProduct>(`${this.productsUrl}/${id}/add-stock`, { quantity });
    }


    
    //  GESTIÓN DE TICKETS Y PEDIDOS
  

    getAllTickets(filters: { status?: string; limit?: number; offset?: number } = {}): Observable<Ticket[]> {
        let params = new HttpParams();
        if (filters.status) params = params.set('status', filters.status);
        if (filters.limit) params = params.set('limit', filters.limit.toString());
        if (filters.offset) params = params.set('offset', filters.offset.toString());
        return this.http.get<Ticket[]>(this.ticketsUrl, { params });
    }

    completeTicket(id: number): Observable<unknown> {
        
        return this.http.post(`${this.ticketsUrl}/${id}/complete`, {});
    }

    cancelTicket(id: number): Observable<unknown> {
        return this.http.post(`${this.ticketsUrl}/${id}/cancel`, {});
    }


    
    //  ESTADÍSTICAS Y VENTAS .. logica de negocio
   

    getAllSales(): Observable<SaleDetail[]> {
        // Pedimos todos los tickets y los mapeamos al modelo visual SaleDetail
        return this.http.get<Ticket[]>(this.ticketsUrl).pipe(
            map((tickets: Ticket[]) => {
                const mapped = tickets.map(t => this.mapTicketToSaleDetail(t));
                this._salesHistory = mapped;
                return mapped;
            })
        );
    }

    filterSalesByPeriod(sales: SaleDetail[], period: string, customStart?: string, customEnd?: string): SaleDetail[] {
        const start = new Date();
        if (period === 'custom') {
            if (!customStart || !customEnd) return sales;
            const from = new Date(customStart);
            const to = new Date(customEnd);
            to.setHours(23, 59, 59);
            return sales.filter(s => s.date >= from && s.date <= to);
        }
        if (period === 'today') start.setHours(0, 0, 0, 0);
        else if (period === 'week') {
            const day = start.getDay() || 7;
            start.setDate(start.getDate() - (day - 1));
            start.setHours(0, 0, 0, 0);
        }
        else if (period === 'month') start.setDate(1);
        else if (period === 'year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
        else return sales;
        return sales.filter(s => s.date >= start);
    }

    getPreviousPeriodSales(period: string): SaleDetail[] {
        const start = new Date();
        const end = new Date();
        if (period === 'today') {
            start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
            const day = start.getDay() || 7;
            start.setDate(start.getDate() - (day - 1 + 7));
            end.setDate(end.getDate() - (day));
            end.setHours(23, 59, 59, 999);
        } else if (period === 'month') {
            start.setMonth(start.getMonth() - 1, 1);
            end.setDate(0); end.setHours(23, 59, 59, 999);
        } else return [];
        return this._salesHistory.filter(s => s.date >= start && s.date <= end);
    }

    private mapTicketToSaleDetail(t: Ticket): SaleDetail {
        return {
            id: t.id,
            date: new Date(t.created_at),
            ticket_number: t.ticket_number,
            customerName: t.notes?.split('|')[0] || 'Cliente Web',
            total: t.total,
            subtotal: t.subtotal,
            status: t.status,
            paymentStatus: (t.status === 'paid' || t.status === 'completed') ? 'Pagado' : 'Impago',
            paymentMethod: t.payment_method,
            items: (t.lines || []).map(l => ({
                id: l.id,
                product_id: l.product_id,
                name: l.product_title,
                price: l.unit_price,
                quantity: l.quantity,
                category: 'General',
                subtotal: l.subtotal
            })),
            seller: 'Venta Online',
            discountCode: '-',
            discountAmount: t.tax_amount,
            notes: t.notes
        };
    }
}