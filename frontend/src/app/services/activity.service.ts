import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClientActivity {
    id: number;
    event_type: string;
    path: string;
    metadata: string;
    created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
    private readonly baseUrl = `${environment.apiUrl}/activity`;
    private readonly publicUrl = `${environment.apiUrl}/api/activity`; // public endpoint to record

    constructor(private http: HttpClient) { }

    recordListRecent(): Observable<ClientActivity[]> {
        return this.http.get<ClientActivity[]>(this.baseUrl);
    }

    recordActivity(eventType: string, path: string, metadata: any = {}): void {
        this.http.post(this.publicUrl, {
            event_type: eventType,
            path: path,
            metadata: JSON.stringify(metadata)
        }).pipe(
            catchError(() => of(null)) // intercept and ignore errors so it doesn't break client exp
        ).subscribe();
    }
}
