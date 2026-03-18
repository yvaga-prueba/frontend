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

// ── Ticket summary que viene del backend ────────────────
// Coincide con dto.TicketSummaryResponse del backend:
// { id, ticket_number, status, payment_method, total,
//   item_count, invoice_type?, invoice_number?, cae?,
//   cae_due_date?, created_at }
export interface BackendTicketSummary {
    id: number;
    ticket_number: string;
    status: string;
    payment_method: string;
    total: number;
    item_count: number;
    invoice_type?: string;
    invoice_number?: string;
    cae?: string;
    cae_due_date?: string;
    created_at: string;
    // Agregamos los campos que faltaban:
    seller_name?: string;
    client_contact?: string;
    coupon_code?: string;
    subtotal?: number;
    tax_amount?: number;
    lines?: any[];
    client_name?: string;
    client_dni?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
    private http = inject(HttpClient);
    private readonly productsUrl = `${environment.apiUrl}/products`;
    // ✅ URL correcta: el backend expone /api/tickets (no /admin/tickets)
    private readonly ticketsUrl = `${environment.apiUrl}/tickets`;

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

    /**
     * Lista todos los tickets (admin). Devuelve TicketSummaryResponse[] del backend.
     * GET /api/tickets
     */
    getAllTickets(filters: { status?: string; limit?: number; offset?: number } = {}): Observable<BackendTicketSummary[]> {
        let params = new HttpParams();
        if (filters.status) params = params.set('status', filters.status);
        if (filters.limit) params = params.set('limit', filters.limit.toString());
        if (filters.offset) params = params.set('offset', filters.offset.toString());
        return this.http.get<BackendTicketSummary[]>(this.ticketsUrl, { params });
    }

    /**
     * Lista solo los tickets con factura AFIP (con CAE).
     * GET /api/tickets/invoices
     */
    getInvoices(filters: { limit?: number; offset?: number } = {}): Observable<BackendTicketSummary[]> {
        let params = new HttpParams();
        if (filters.limit) params = params.set('limit', filters.limit.toString());
        if (filters.offset) params = params.set('offset', filters.offset.toString());
        return this.http.get<BackendTicketSummary[]>(`${this.ticketsUrl}/invoices`, { params });
    }

    completeTicket(id: number): Observable<unknown> {
        return this.http.post(`${this.ticketsUrl}/${id}/complete`, {});
    }

    cancelTicket(id: number): Observable<unknown> {
        return this.http.post(`${this.ticketsUrl}/${id}/cancel`, {});
    }

    updateTrackingNumber(id: number, trackingNumber: string): Observable<unknown> {
        return this.http.put(`${this.ticketsUrl}/${id}/tracking`, { tracking_number: trackingNumber });
    }

    //  ESTADÍSTICAS Y VENTAS — lógica de negocio

    /**
     * Trae todos los tickets y los mapea al modelo visual SaleDetail.
     * Los items del TicketSummary no vienen en el list, así que usamos
     * item_count y construimos un resumen sin líneas de detalle hasta que
     * el usuario abra un ticket específico.
     */
    getAllSales(): Observable<SaleDetail[]> {
        return this.getAllTickets().pipe(
            map((tickets: BackendTicketSummary[]) => {
                const mapped = tickets.map(t => this.mapSummaryToSaleDetail(t));
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

    
    /** Mapea un TicketSummaryResponse del backend a SaleDetail */
    private mapSummaryToSaleDetail(t: BackendTicketSummary): SaleDetail {
        return {
            id: t.id,
            date: new Date(t.created_at),
            ticket_number: t.ticket_number,
            customerName: t.client_contact || 'Cliente Web',
            total: t.total,
            subtotal: t.subtotal ?? t.total,             
            tax_amount: t.tax_amount ?? 0,
            status: t.status as any,
            paymentStatus: (t.status === 'paid' || t.status === 'completed') ? 'Pagado' : 'Impago',
            paymentMethod: t.payment_method as any,
            items: t.lines || [],         
            item_count: t.item_count,          
            seller_name: t.seller_name || 'Venta Online',
            client_contact: t.client_contact || '-',
            client_name: t.client_name,
            client_dni: t.client_dni,
            coupon_code: t.coupon_code || '-',
            discountCode: t.coupon_code || '-',
            discountAmount: t.tax_amount || 0,
            notes: undefined,
            // Campos AFIP
            invoice_type: t.invoice_type,
            invoice_number: t.invoice_number,
            cae: t.cae,
            cae_due_date: t.cae_due_date,
        } as any;
    }

    // ==========================================
    // === CONFIGURACIONES (META MENSUAL) =======
    // ==========================================

    private getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            Authorization: `Bearer ${token}`
        };
    }

    getMonthlyGoal(): Observable<{goal: string}> {
        return this.http.get<{goal: string}>(`${environment.apiUrl}/settings/goal`, { 
            headers: this.getAuthHeaders() 
        });
    }

    setMonthlyGoal(goal: number): Observable<any> {
        return this.http.post(`${environment.apiUrl}/settings/goal`, { goal: goal.toString() }, { 
            headers: this.getAuthHeaders() 
        });
    }
}