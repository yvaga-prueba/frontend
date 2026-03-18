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
    checkoutStep = signal<1 | 2 | 3>(1); 
    
    clientData = signal({
        email: '',
        firstName: '',
        lastName: '',
        dni: '',
        phone: ''
    });

    deliveryData = signal({
        method: 'pickup', 
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

    ngOnInit() {
        const currentUser = this.auth.currentUser();
        if (currentUser) {
            this.clientData.set({
                email: currentUser.email || '',
                firstName: currentUser.first_name ||  '',
                lastName: currentUser.last_name || '',
                dni: currentUser.dni || '',      
                phone: currentUser.phone || ''
            });
        }
    }

    // --- FUNCIONES PRA GUARDAR LOS DATOS ---
    updateClient(field: string, value: string) {
        this.clientData.update((d: any) => ({ ...d, [field]: value }));
    }

    updateDelivery(field: string, value: string) {
        this.deliveryData.update((d: any) => ({ ...d, [field]: value }));
    }

    // --- NAVEGACIÓN DEL ACORDEÓN ---
    setStep(step: 1 | 2 | 3) {
        if (step < this.checkoutStep()) {
            this.checkoutStep.set(step);
        }
    }

    nextStep() {
        if (this.checkoutStep() === 1) {
            const d = this.clientData();
            console.log("Datos capturados:", d); // Para ver que etsa leyendo mal
            
            const faltantes = [];
            if (!d.email || d.email.trim() === '') faltantes.push('Correo Electrónico');
            if (!d.firstName || d.firstName.trim() === '') faltantes.push('Nombre');
            if (!d.lastName || d.lastName.trim() === '') faltantes.push('Apellido');
            if (!d.dni || d.dni.trim() === '') faltantes.push('DNI / CUIT');
            if (!d.phone || d.phone.trim() === '') faltantes.push('Teléfono');

            if (faltantes.length > 0) {
                alert('Por favor, completá los siguientes campos:\n- ' + faltantes.join('\n- '));
                return;
            }
            
            if (!d.email.includes('@')) {
                alert('Por favor, ingresá un correo válido.');
                return;
            }
            
            this.checkoutStep.set(2);
            
        } else if (this.checkoutStep() === 2) {
            const d = this.deliveryData();
            
            if (d.method === 'shipping') {
                const faltantesEnvio = [];
                if (!d.street || d.street.trim() === '') faltantesEnvio.push('Calle');
                if (!d.number || d.number.trim() === '') faltantesEnvio.push('Número / Piso');
                if (!d.city || d.city.trim() === '') faltantesEnvio.push('Ciudad');
                if (!d.zip || d.zip.trim() === '') faltantesEnvio.push('Código Postal');
                
                if (faltantesEnvio.length > 0) {
                    alert('Para el envío a domicilio faltan estos datos:\n- ' + faltantesEnvio.join('\n- '));
                    return;
                }
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
        //  Si no tiene cuenta, no lo dejamos pasar y lo mandamos a loguearse
        if (!this.isLoggedIn()) {
            alert('¡Hola! Para finalizar tu compra necesitás iniciar sesión o crearte una cuenta rápido.');
            // Lo mandamos al login, y le decimos que cuando termine vuelva al '/cart'
            this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/cart' } });
            return;
        }

        // Si ya está logueado, abrimos el checkout normal
        this.cart.recordEvent('checkout_started', { items: this.items().length, total: this.totalPrice() });
        this.purchaseError.set('');
        this.checkoutStep.set(1); 
        this.showCheckout.set(true);
    }

    cancelCheckout() {
        this.showCheckout.set(false);
        this.purchaseError.set('');
    }

    
    /* ── PAGO FINAL ── */
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

        const dClient = this.clientData();
        const finalName = `${dClient.firstName} ${dClient.lastName}`.trim();
        const finalEmail = dClient.email;
        const finalDNI = dClient.dni;
        const finalPhone = dClient.phone;

        let extraNotes = this.notes();
        const dDeliv = this.deliveryData();
        
        if (dDeliv.method === 'shipping') {
            extraNotes += ` [ENVÍO A DOMICILIO: ${dDeliv.street} ${dDeliv.number}, ${dDeliv.city}, CP: ${dDeliv.zip}, Prov: ${dDeliv.province}]`;
        } else {
            extraNotes += ` [RETIRO EN LOCAL]`;
        }

        const payloadFinal = {
            payment_method: backendMethod,
            notes: extraNotes,
            client_name: finalName,
            client_email: finalEmail,
            client_dni: finalDNI,
            client_contact: finalPhone,
            coupon_code: this.couponCode().toUpperCase(),
            items
        };

        
        this.paymentSvc.createPreference(payloadFinal).subscribe({
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