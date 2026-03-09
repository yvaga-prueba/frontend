import {
    Component, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import { PaymentService, PreferenceResponse } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { productPrice, getImageUrl } from '../../models/product.model';

export type PaymentMethod = 'cash' | 'card' | 'transfer';

@Component({
    standalone: true,
    selector: 'app-cart',
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartComponent {

    /* ── Computed from cart ── */
    items = computed(() => this.cart.items());
    totalUnits = computed(() => this.cart.totalUnits());
    totalPrice = computed(() => this.cart.totalPrice());
    isEmpty = computed(() => this.items().length === 0);

    /* ── Checkout ── */
    showCheckout = signal(false);
    paymentMethod = signal<PaymentMethod>('card');
    notes = signal('');
    purchasing = signal(false);
    purchaseError = signal('');

    /* ── Estados de resultado ── */
    /** 'none' | 'transfer' | 'cash' - se muestra el panel de resultado en-página */
    resultMode = signal<'none' | 'transfer' | 'cash'>('none');
    resultData = signal<PreferenceResponse | null>(null);

    /* ── Remove confirm ── */
    removingId = signal<number | null>(null);

    readonly formatPrice = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

    readonly productPrice = productPrice;
    readonly getImageUrl = getImageUrl;

    isLoggedIn = computed(() => this.auth.isLoggedIn());

    constructor(
        public cart: CartService,
        private paymentSvc: PaymentService,
        private auth: AuthService,
        private router: Router
    ) { }

    increment(productId: number, currentQty: number, stock: number) {
        if (currentQty < stock) this.cart.setQuantity(productId, currentQty + 1);
    }

    decrement(productId: number, currentQty: number) {
        if (currentQty > 1) this.cart.setQuantity(productId, currentQty - 1);
    }

    askRemove(productId: number) { this.removingId.set(productId); }
    cancelRemove() { this.removingId.set(null); }
    confirmRemove(productId: number) {
        this.cart.removeItem(productId);
        this.removingId.set(null);
    }

    clearCart() { if (confirm('¿Vaciar el carrito?')) this.cart.clear(); }

    openCheckout() {
        if (!this.isLoggedIn()) {
            this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/cart' } });
            return;
        }
        this.cart.recordEvent('checkout_started', { items: this.items().length, total: this.totalPrice() });
        this.purchaseError.set('');
        this.showCheckout.set(true);
    }

    cancelCheckout() {
        this.showCheckout.set(false);
        this.purchaseError.set('');
    }

    confirmPurchase() {
        if (this.purchasing()) return;
        this.purchasing.set(true);
        this.purchaseError.set('');

        const items = this.items().map(i => ({
            product_id: i.product.id,
            quantity: i.quantity
        }));

        this.cart.recordEvent('purchase_attempt', { method: this.paymentMethod(), total: this.totalPrice() });

        this.paymentSvc.createPreference({
            payment_method: this.paymentMethod(),
            notes: this.notes(),
            items
        }).subscribe({
            next: (res) => {
                this.purchasing.set(false);
                this.showCheckout.set(false);

                if (res.redirect_url) {
                    // Tarjeta o transferencia → limpiar carrito y redirigir a MercadoPago
                    this.cart.clear();
                    window.location.href = res.redirect_url;
                    return;
                }

                // Efectivo → mostrar resultado en-página
                this.cart.clear();
                this.resultData.set(res);
                this.resultMode.set('cash');
            },
            error: (err) => {
                this.purchasing.set(false);
                if (err?.status === 401) {
                    // Sesión expirada → redirigir al login
                    this.purchaseError.set('Tu sesión expiró. Redirigiendo al login...');
                    setTimeout(() => {
                        this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/cart' } });
                    }, 2000);
                    return;
                }
                this.purchaseError.set(
                    err?.error?.message ?? err?.error?.error ?? 'Error al procesar el pago. Intentá de nuevo.'
                );
            }
        });
    }

    goToProducts() { this.router.navigate(['/products']); }
    goToPerfil() { this.router.navigate(['/perfil']); }

    copied = signal('');
    copyText(text: string) {
        navigator.clipboard?.writeText(text).then(() => {
            this.copied.set(text);
            setTimeout(() => this.copied.set(''), 2000);
        });
    }
}
