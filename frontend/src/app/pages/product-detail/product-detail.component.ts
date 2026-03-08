import { Component, OnInit, signal, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { ProductImageService, ProductImage } from '../../services/product-image.service';
import { Product, productPrice, getImageUrl } from '../../models/product.model';

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

    // Variantes (mismo título, otros talles)
    variants = signal<Product[]>([]);

    // Galería de imágenes
    images = signal<ProductImage[]>([]);
    activeImage = signal<string | null>(null);

    readonly productPrice = productPrice;
    readonly getImageUrl = getImageUrl;
    readonly formatPrice = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

    isInCart = () => {
        const p = this.product();
        return p ? this.cart.isInCart(p.id) : false;
    };

    private cdr = inject(ChangeDetectorRef);

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productSvc: ProductService,
        public cart: CartService,
        private productImageSvc: ProductImageService
    ) { }

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const id = Number(params.get('id'));
            if (!id) {
                this.router.navigate(['/products']);
                return;
            }
            this.loadProductData(id);
        });
    }

    private loadProductData(id: number) {
        this.loading.set(true);
        this.error.set('');

        this.productSvc.getProductById(id).subscribe({
            next: p => {
                this.product.set(p);
                this.activeImage.set(p.image_url ?? null);
                this.loading.set(false);

                // Cargar imágenes
                this.productImageSvc.getImages(p.id).subscribe(imgs => {
                    this.images.set(imgs ?? []);
                    if (imgs && imgs.length > 0 && !this.activeImage()) {
                        this.activeImage.set(imgs[0].url);
                    }
                    this.cdr.markForCheck();
                });

                // Cargar todas las variantes (mismo título)
                this.productSvc.getProductVariants(p.id).subscribe(vars => {
                    this.variants.set(vars ?? []);
                    this.cdr.markForCheck();
                });
            },
            error: () => {
                this.error.set('No se pudo cargar el producto.');
                this.loading.set(false);
            }
        });
    }

    setActiveImage(url: string) {
        this.activeImage.set(url);
    }

    prevImage() {
        const imgs = this.images();
        if (imgs.length <= 1) return;
        const currentUrl = this.activeImage();
        const currentIndex = imgs.findIndex(img => img.url === currentUrl);
        if (currentIndex > 0) {
            this.activeImage.set(imgs[currentIndex - 1].url);
        } else {
            this.activeImage.set(imgs[imgs.length - 1].url);
        }
    }

    nextImage() {
        const imgs = this.images();
        if (imgs.length <= 1) return;
        const currentUrl = this.activeImage();
        const currentIndex = imgs.findIndex(img => img.url === currentUrl);
        if (currentIndex < imgs.length - 1) {
            this.activeImage.set(imgs[currentIndex + 1].url);
        } else {
            this.activeImage.set(imgs[0].url);
        }
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
