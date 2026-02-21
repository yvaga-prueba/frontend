import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TicketSummary } from './ticket.service';

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
    tickets?: TicketSummary[];   // backend returns array directly
}

@Injectable({ providedIn: 'root' })
export class AdminService {
    private readonly productsUrl = `${environment.apiUrl}/products`;
    private readonly ticketsUrl = `${environment.apiUrl}/tickets`;

    constructor(private http: HttpClient) { }

    /* ── Products ─── */
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

    /* ── Tickets (admin) ─── */
    getAllTickets(filters: { status?: string; limit?: number; offset?: number } = {}): Observable<TicketSummary[]> {
        let params = new HttpParams();
        if (filters.status) params = params.set('status', filters.status);
        if (filters.limit) params = params.set('limit', filters.limit.toString());
        if (filters.offset) params = params.set('offset', filters.offset.toString());
        return this.http.get<TicketSummary[]>(this.ticketsUrl, { params });
    }

    completeTicket(id: number): Observable<unknown> {
        return this.http.post(`${this.ticketsUrl}/${id}/complete`, {});
    }

    cancelTicket(id: number): Observable<unknown> {
        return this.http.post(`${this.ticketsUrl}/${id}/cancel`, {});
    }
}
