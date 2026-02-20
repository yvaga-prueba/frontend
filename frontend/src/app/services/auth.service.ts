import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface RegisterResponse {
    user: UserResponse;
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface UserResponse {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    provider: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly baseUrl = `${environment.apiUrl}/auth`;

    // Estado reactivo del usuario
    private _currentUser = signal<UserResponse | null>(null);
    currentUser = this._currentUser.asReadonly();
    isLoggedIn = computed(() => !!this._currentUser());

    constructor(private http: HttpClient) {
        this.restoreSession();
    }

    login(data: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.baseUrl}/login`, data).pipe(
            tap(res => {
                localStorage.setItem('token', res.access_token);
                this.fetchMe().subscribe();
            })
        );
    }

    register(data: RegisterRequest): Observable<RegisterResponse> {
        return this.http.post<RegisterResponse>(`${this.baseUrl}/register`, data).pipe(
            tap(res => {
                localStorage.setItem('token', res.access_token);
                this._currentUser.set(res.user);
            })
        );
    }

    fetchMe(): Observable<UserResponse> {
        return this.http.get<UserResponse>(`${this.baseUrl}/me`).pipe(
            tap(user => this._currentUser.set(user))
        );
    }

    logout(): void {
        localStorage.removeItem('token');
        this._currentUser.set(null);
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    private restoreSession(): void {
        const token = this.getToken();
        if (token) {
            this.fetchMe().subscribe({ error: () => this.logout() });
        }
    }
}
