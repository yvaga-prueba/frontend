import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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

/* ─── Claves de localStorage ─────────────────────────── */
const TOKEN_KEY = 'yvaga_token';
const USER_KEY = 'yvaga_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly baseUrl = `${environment.apiUrl}/auth`;

    /** true solo cuando corre en el navegador (no en el servidor SSR) */
    private readonly isBrowser: boolean;

    /**
     * El signal arranca con null; en el constructor se hidrata
     * de forma síncrona desde localStorage (solo en el browser).
     */
    private _currentUser = signal<UserResponse | null>(null);
    currentUser = this._currentUser.asReadonly();
    isLoggedIn = computed(() => !!this._currentUser());

    constructor(
        private http: HttpClient,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);

        if (this.isBrowser) {
            // 1. Migrar token de clave vieja (una sola vez)
            this.migrateOldKeys();
            // 2. Restaurar usuario cacheado de forma síncrona
            const cached = this.loadCachedUser();
            if (cached) this._currentUser.set(cached);
            // 3. Revalidar en background contra el servidor
            this.refreshSession();
        }
    }

    /* ── Login ────────────────────────────────────────── */
    login(data: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.baseUrl}/login`, data).pipe(
            tap(res => {
                this.saveToken(res.access_token);
                this.fetchMe().subscribe();
            })
        );
    }

    /* ── Register ─────────────────────────────────────── */
    register(data: RegisterRequest): Observable<RegisterResponse> {
        return this.http.post<RegisterResponse>(`${this.baseUrl}/register`, data).pipe(
            tap(res => {
                this.saveToken(res.access_token);
                this.setUser(res.user);
            })
        );
    }

    /* ── Obtener perfil del backend ───────────────────── */
    fetchMe(): Observable<UserResponse> {
        return this.http.get<UserResponse>(`${this.baseUrl}/me`).pipe(
            tap(user => this.setUser(user))
        );
    }

    /* ── Logout ───────────────────────────────────────── */
    logout(): void {
        this.removeStorage(TOKEN_KEY);
        this.removeStorage(USER_KEY);
        this._currentUser.set(null);
    }

    /* ── Token público (usado por el interceptor) ─────── */
    getToken(): string | null {
        return this.getStorage(TOKEN_KEY);
    }

    /* ══════════════════════════════════════════════════
       PRIVADOS
    ══════════════════════════════════════════════════ */

    /** Guarda el token JWT */
    private saveToken(token: string): void {
        this.setStorage(TOKEN_KEY, token);
    }

    /** Actualiza el signal Y el caché localStorage */
    private setUser(user: UserResponse): void {
        this._currentUser.set(user);
        this.setStorage(USER_KEY, JSON.stringify(user));
    }

    /** Lee el usuario cacheado de forma síncrona */
    private loadCachedUser(): UserResponse | null {
        try {
            const raw = this.getStorage(USER_KEY);
            return raw ? (JSON.parse(raw) as UserResponse) : null;
        } catch {
            return null;
        }
    }

    /**
     * Re-valida el token almacenado contra el backend en segundo plano.
     *
     * POLÍTICA DE ERRORES:
     *  - 401 / 403 → token inválido o expirado → logout (sesión real terminada)
     *  - Cualquier otro error (red, CORS, timeout, 5xx) → NO hacer logout;
     *    se conserva la sesión cacheada para no romper la UX por problemas
     *    transitorios del servidor o la conexión.
     */
    private refreshSession(): void {
        if (!this.getToken()) return;
        this.fetchMe().subscribe({
            error: (err) => {
                const status: number = err?.status ?? 0;
                if (status === 401 || status === 403) {
                    this.logout();
                }
                // En cualquier otro caso (0 = sin red, 5xx, etc.) conservamos
                // el caché: el usuario sigue "logueado" con los datos guardados.
            }
        });
    }

    /**
     * Migra sesiones guardadas con la clave antigua 'token' → 'yvaga_token'.
     * Se ejecuta una sola vez al arrancar; luego elimina la clave vieja.
     */
    private migrateOldKeys(): void {
        const oldToken = this.getStorage('token');
        if (oldToken && !this.getStorage(TOKEN_KEY)) {
            this.setStorage(TOKEN_KEY, oldToken);
        }
        if (oldToken) this.removeStorage('token');
    }

    /* ── Wrappers seguros para SSR ────────────────────── */
    private getStorage(key: string): string | null {
        return this.isBrowser ? localStorage.getItem(key) : null;
    }

    private setStorage(key: string, value: string): void {
        if (this.isBrowser) localStorage.setItem(key, value);
    }

    private removeStorage(key: string): void {
        if (this.isBrowser) localStorage.removeItem(key);
    }
}
