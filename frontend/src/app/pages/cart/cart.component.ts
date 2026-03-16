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

// PASADO A ESPAÑOL
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

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
    paymentMethod = signal<PaymentMethod>('tarjeta'); // DEFAULT ESPAÑOL
    notes = signal('');
    purchasing = signal(false);
    purchaseError = signal('');
    guestName = signal('');
    guestEmail = signal('');
    couponCode = signal(''); // <-- NUEVO: Variable para el cupón

    /* ── Estados de resultado ── */
    // PASADO A ESPAÑOL
    resultMode = signal<'none' | 'transferencia' | 'efectivo'>('none');
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

        // --- VALIDACIÓN DE INVITADOS ---
        if (!this.isLoggedIn()) {
            if (!this.guestName() || !this.guestEmail()) {
                this.purchaseError.set('Por favor, ingresá tu nombre y correo para continuar.');
                return;
            }
            if (!this.guestEmail().includes('@')) {
                this.purchaseError.set('Por favor, ingresá un correo válido.');
                return;
            }
        }
        // -------------------------------

        this.purchasing.set(true);
        this.purchaseError.set('');

        const items = this.items().map(i => ({
            product_id: i.product.id,
            quantity: i.quantity
        }));

        this.cart.recordEvent('purchase_attempt', { method: this.paymentMethod(), total: this.totalPrice() });

        let backendMethod: 'cash' | 'card' | 'transfer' = 'card';
        if (this.paymentMethod() === 'efectivo') backendMethod = 'cash';
        else if (this.paymentMethod() === 'transferencia') backendMethod = 'transfer';

        // --- NUEVO: EXTRACCIÓN DINÁMICA DE DATOS ---
        let finalName = this.guestName();
        let finalEmail = this.guestEmail();

        if (this.isLoggedIn()) {
            const user = this.auth.currentUser();
            if (user) {
                // Sacamos los datos reales del signal de autenticación
                finalName = `${user.first_name} ${user.last_name}`.trim();
                finalEmail = user.email;
            }
        }
        // -------------------------------------------

        this.paymentSvc.createPreference({
            payment_method: backendMethod, // Mandamos el método traducido
            notes: this.notes(),
            client_name: finalName,   // <-- Mandamos el nombre real
            client_email: finalEmail, // <-- Mandamos el correo real
            coupon_code: this.couponCode().toUpperCase(), // Mandamos el cupón en mayúsculas
            items
        }).subscribe({
            next: (res) => {
                this.purchasing.set(false);
                this.showCheckout.set(false);

                if (res.redirect_url) {
                    this.cart.clear();
                    window.location.href = res.redirect_url;
                    return;
                }

                this.cart.clear();
                this.resultData.set(res);
                this.resultMode.set('efectivo'); 
            },
            error: (err) => {
                this.purchasing.set(false);
                if (err?.status === 401) {
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