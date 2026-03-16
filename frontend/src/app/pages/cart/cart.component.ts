import {
    Component, signal, computed, ChangeDetectionStrategy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import { PaymentService, PreferenceResponse } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { productPrice, getImageUrl } from '../../models/product.model';

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

@Component({
    standalone: true,
    selector: 'app-cart',
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartComponent implements OnInit {

    /* ── Computed from cart ── */
    items = computed(() => this.cart.items());
    totalUnits = computed(() => this.cart.totalUnits());
    totalPrice = computed(() => this.cart.totalPrice());
    isEmpty = computed(() => this.items().length === 0);

    /* ── Checkout Original ── */
    showCheckout = signal(false);
    notes = signal('');
    purchasing = signal(false);
    purchaseError = signal('');
    couponCode = signal('');

    /* ── NUEVO: FLUJO DE CHECKOUT (ACORDEÓN) ── */
    checkoutStep = signal<1 | 2 | 3>(1); // 1: Datos, 2: Envío, 3: Pago
    
    clientData = signal({
        email: '',
        firstName: '',
        lastName: '',
        dni: '',
        phone: ''
    });

    deliveryData = signal({
        method: 'pickup', // 'pickup' o 'shipping'
        street: '',
        number: '',
        city: '',
        zip: '',
        province: '' 
    });

    paymentMethod = signal<PaymentMethod>('tarjeta');

    /* ── Estados de resultado ── */
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

    // --- NUEVO: AUTOCOMPLETAR DATOS ---
    ngOnInit() {
        const currentUser = this.auth.currentUser();
        if (currentUser) {
            this.clientData.set({
                email: currentUser.email || '',
                firstName: currentUser.first_name ||  '',
                lastName: currentUser.last_name || '',
                dni:  '',
                phone: ''
            });
        }
    }

    // --- NUEVO: NAVEGACIÓN DEL ACORDEÓN ---
    setStep(step: 1 | 2 | 3) {
        if (step < this.checkoutStep()) {
            this.checkoutStep.set(step);
        }
    }

    nextStep() {
        if (this.checkoutStep() === 1) {
            const d = this.clientData();
            if (!d.email || !d.firstName || !d.lastName || !d.dni || !d.phone) {
                alert('Por favor, completá todos los datos de contacto y el DNI.');
                return;
            }
            if (!d.email.includes('@')) {
                alert('Por favor, ingresá un correo válido.');
                return;
            }
            this.checkoutStep.set(2);
        } else if (this.checkoutStep() === 2) {
            const d = this.deliveryData();
            if (d.method === 'shipping' && (!d.street || !d.number || !d.city || !d.zip)) {
                alert('Por favor, completá tu dirección completa para el envío.');
                return;
            }
            this.checkoutStep.set(3);
        }
    }

    /* ── Control del carrito ── */
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
        this.checkoutStep.set(1); // Siempre que abre el checkout, arranca en el paso 1
        this.showCheckout.set(true);
    }

    cancelCheckout() {
        this.showCheckout.set(false);
        this.purchaseError.set('');
    }

    /* ── PAGO FINAL (ACTUALIZADO CON LOS NUEVOS DATOS) ── */
    finalizarCompra() {
        if (this.purchasing()) return;

        this.purchasing.set(true);
        this.purchaseError.set('');

        const items = this.items().map(i => ({
            product_id: i.product.id,
            quantity: i.quantity
        }));

        let backendMethod: 'cash' | 'card' | 'transfer' = 'card';
        if (this.paymentMethod() === 'efectivo') backendMethod = 'cash';
        else if (this.paymentMethod() === 'transferencia') backendMethod = 'transfer';

        // 1. Extraemos los datos limpios del cliente
        const dClient = this.clientData();
        const finalName = `${dClient.firstName} ${dClient.lastName}`.trim();
        const finalEmail = dClient.email;
        const finalDNI = dClient.dni;
        const finalPhone = dClient.phone;

        // 2. En las notas AHORA SOLO GUARDAMOS el envío
        let extraNotes = this.notes();
        const dDeliv = this.deliveryData();
        
        if (dDeliv.method === 'shipping') {
            extraNotes += ` [ENVÍO A DOMICILIO: ${dDeliv.street} ${dDeliv.number}, ${dDeliv.city}, CP: ${dDeliv.zip}, Prov: ${dDeliv.province}]`;
        } else {
            extraNotes += ` [RETIRO EN LOCAL]`;
        }

        // 3. Mandamos la orden oficial con cada dato en su respectiva columna
        this.paymentSvc.createPreference({
            payment_method: backendMethod,
            notes: extraNotes,
            client_name: finalName,
            client_email: finalEmail,
            client_dni: finalDNI,         
            client_contact: finalPhone,    
            coupon_code: this.couponCode().toUpperCase(),
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