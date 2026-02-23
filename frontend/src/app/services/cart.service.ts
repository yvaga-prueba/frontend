import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Product, productPrice } from '../models/product.model';

export interface CartItem {
    product: Product;
    quantity: number;
}

const CART_KEY = 'yvaga_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
    private readonly isBrowser: boolean;

    private _items = signal<CartItem[]>([]);

    /** Lista de items reactiva */
    items = this._items.asReadonly();

    /** Total de unidades en el carrito (para el badge de la navbar) */
    totalUnits = computed(() =>
        this._items().reduce((s, i) => s + i.quantity, 0)
    );

    /** Precio total del carrito */
    totalPrice = computed(() =>
        this._items().reduce((s, i) => s + productPrice(i.product) * i.quantity, 0)
    );

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        this.isBrowser = isPlatformBrowser(platformId);
        if (this.isBrowser) this.loadFromStorage();
    }

    /** Agrega un producto al carrito (incrementa si ya existe) */
    addItem(product: Product, quantity = 1): void {
        this._items.update(items => {
            const idx = items.findIndex(i => i.product.id === product.id);
            if (idx >= 0) {
                const updated = [...items];
                updated[idx] = {
                    ...updated[idx],
                    quantity: Math.min(updated[idx].quantity + quantity, product.stock)
                };
                return updated;
            }
            return [...items, { product, quantity }];
        });
        this.persist();
    }

    /** Cambia la cantidad de un item (0 = eliminar) */
    setQuantity(productId: number, quantity: number): void {
        if (quantity <= 0) {
            this.removeItem(productId);
            return;
        }
        this._items.update(items =>
            items.map(i =>
                i.product.id === productId ? { ...i, quantity } : i
            )
        );
        this.persist();
    }

    /** Elimina un producto del carrito */
    removeItem(productId: number): void {
        this._items.update(items => items.filter(i => i.product.id !== productId));
        this.persist();
    }

    /** Vacía el carrito completo */
    clear(): void {
        this._items.set([]);
        this.persist();
    }

    /** Indica si un producto ya está en el carrito */
    isInCart(productId: number): boolean {
        return this._items().some(i => i.product.id === productId);
    }

    private persist(): void {
        if (!this.isBrowser) return;
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(this._items()));
        } catch { /* quota exceeded — ignorar */ }
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(CART_KEY);
            if (raw) this._items.set(JSON.parse(raw) as CartItem[]);
        } catch {
            this._items.set([]);
        }
    }
}
