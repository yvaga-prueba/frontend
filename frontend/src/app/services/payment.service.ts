import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaymentItem {
    product_id: number;
    quantity: number;
}

export interface CreatePreferencePayload {
    items: PaymentItem[];
    payment_method: 'card' | 'transfer' | 'cash';
    notes?: string;
    client_name?: string; 
    client_email?: string; 
}

/** Respuesta del backend — varía según el método de pago */
export interface PreferenceResponse {
    // Card → redirect a MercadoPago
    redirect_url?: string;
    // Transfer → datos bancarios
    cbu?: string;
    alias?: string;
    bank_name?: string;
    account_name?: string;
    amount?: number;
    // Todos → identificación del ticket
    ticket_number?: string;
    ticket_id?: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
    private readonly baseUrl = `${environment.apiUrl}/payments`;

    constructor(private http: HttpClient) { }

    createPreference(payload: CreatePreferencePayload): Observable<PreferenceResponse> {
        return this.http.post<PreferenceResponse>(`${this.baseUrl}/preference`, payload);
    }
}
