import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ShippingEvent {
    date: string;
    status: string;
    reason?: string;
    location?: string;
}

export interface ShippingTracking {
    tracking_number: string;
    status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
    events: ShippingEvent[];
}

@Injectable({
    providedIn: 'root'
})
export class ShippingService {
    private readonly baseUrl = `${environment.apiUrl}/shipping`;

    constructor(private http: HttpClient) { }

    getTrackingInfo(trackingNumber: string): Observable<ShippingTracking> {
        return this.http.get<ShippingTracking>(`${this.baseUrl}/${trackingNumber}`);
    }
}
