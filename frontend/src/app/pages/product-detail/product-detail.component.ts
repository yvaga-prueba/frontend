import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product, productPrice } from '../../models/product.model';

@Component({
    standalone: true,
    selector: 'app-product-detail',
    imports: [CommonModule, RouterLink],
    templateUrl: './product-detail.component.html',
    styleUrls: ['./product-detail.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailComponent implements OnInit {

    product = signal<Product | null>(null);
    loading = signal(true);
    error = signal('');
    quantity = signal(1);
    toastMsg = signal('');
    private toastTimer?: ReturnType<typeof setTimeout>;

    readonly productPrice = productPrice;
    readonly formatPrice = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

    isInCart = () => {
        const p = this.product();
        return p ? this.cart.isInCart(p.id) : false;
    };

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productSvc: ProductService,
        public cart: CartService
    ) { }

    ngOnInit() {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (!id) { this.router.navigate(['/products']); return; }

        this.productSvc.getProductById(id).subscribe({
            next: p => { this.product.set(p); this.loading.set(false); },
            error: () => {
                this.error.set('No se pudo cargar el producto.');
                this.loading.set(false);
            }
        });
    }

    incQty() {
        const p = this.product();
        if (!p) return;
        this.quantity.update(q => Math.min(q + 1, p.stock));
    }

    decQty() { this.quantity.update(q => Math.max(q - 1, 1)); }

    addToCart() {
        const p = this.product();
        if (!p || p.stock <= 0) return;
        this.cart.addItem(p, this.quantity());
        this.showToast('¡Producto añadido al carrito!');
    }

    private showToast(msg: string) {
        clearTimeout(this.toastTimer);
        this.toastMsg.set(msg);
        this.toastTimer = setTimeout(() => this.toastMsg.set(''), 2500);
    }
}
