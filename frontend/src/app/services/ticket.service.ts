import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TicketStatus = 'pending' | 'paid' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface TicketLine {
    id: number;
    product_id: number;
    product_title: string;
    product_size: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    created_at: string;
}

export interface Ticket {
    id: number;
    user_id: number;
    ticket_number: string;
    status: TicketStatus;
    payment_method: PaymentMethod;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes?: string;
    invoice_type?: string;
    invoice_number?: string;
    cae?: string;
    cae_due_date?: string;
    lines: TicketLine[];
    paid_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    created_at: string;
    updated_at: string;
}

export interface TicketSummary {
    id: number;
    ticket_number: string;
    status: TicketStatus;
    payment_method: PaymentMethod;
    total: number;
    item_count: number;
    invoice_type?: string;
    invoice_number?: string;
    cae?: string;
    cae_due_date?: string;
    created_at: string;
}

export interface MyTicketsResponse {
    tickets: TicketSummary[];
}

export interface CreateTicketLine {
    product_id: number;
    quantity: number;
}

export interface CreateTicketPayload {
    payment_method: PaymentMethod;
    notes?: string;
    items: CreateTicketLine[];   // backend espera "items", no "lines"
}

@Injectable({ providedIn: 'root' })
export class TicketService {
    private readonly baseUrl = `${environment.apiUrl}/tickets`;

    constructor(private http: HttpClient) { }

    getMyTickets(): Observable<TicketSummary[]> {
        return this.http.get<TicketSummary[]>(`${this.baseUrl}/my`);
    }

    getTicketById(id: number): Observable<Ticket> {
        return this.http.get<Ticket>(`${this.baseUrl}/${id}`);
    }

    createTicket(payload: CreateTicketPayload): Observable<Ticket> {
        return this.http.post<Ticket>(this.baseUrl, payload);
    }
}