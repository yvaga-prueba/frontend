import {
    Component, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product, productPrice, getImageUrl } from '../../models/product.model';

const CATEGORIES = [
    'Remeras', 'Buzos', 'Pantalones', 'Gorras',
    'Camperas', 'Accesorios', 'Calzado'
];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export interface ProductWithVariants extends Product {
    variants: Product[];
}

@Component({
    standalone: true,
    selector: 'app-products',
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './products.component.html',
    styleUrls: ['./products.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsComponent implements OnInit, OnDestroy {

    /* ── Filtros ── */
    searchQuery = signal('');
    activeCategory = signal('');
    activeSize = signal('');
    sortBy = signal<'default' | 'price-asc' | 'price-desc' | 'name'>('default');

    /* ── Datos ── */
    allProducts = signal<Product[]>([]);
    loading = signal(true);
    error = signal('');
    nextCursor = signal<string | undefined>(undefined);
    loadingMore = signal(false);

    /* ── Toast de carrito ── */
    toastMsg = signal('');
    private toastTimer?: ReturnType<typeof setTimeout>;

    /* ── Computed: productos filtrados y ordenados (cliente) ── */
    filteredProducts = computed<ProductWithVariants[]>(() => {
        let list = [...this.allProducts()];
        const q = this.searchQuery().toLowerCase().trim();
        const cat = this.activeCategory().toLowerCase();
        const size = this.activeSize();

        if (q) list = list.filter(p => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
        if (cat) list = list.filter(p => p.category.toLowerCase() === cat);
        if (size) list = list.filter(p => p.size === size);

        // Agrupar por título para mostrar solo un representante con sus variantes
        const grouped = new Map<string, { main: Product, variants: Product[] }>();
        for (const p of list) {
            const key = p.title.toLowerCase().trim();
            if (!grouped.has(key)) {
                grouped.set(key, { main: p, variants: [p] });
            } else {
                const group = grouped.get(key)!;
                group.variants.push(p);
                if (p.stock > 0 && group.main.stock <= 0) {
                    group.main = p; // Preferimos mostrar el que sí tiene stock
                }
            }
        }

        let groupedList: ProductWithVariants[] = Array.from(grouped.values()).map(g => {
            // Ordenar variantes lógicamente por array de SIZES preferido
            g.variants.sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size));
            return {
                ...g.main,
                variants: g.variants
            };
        });

        switch (this.sortBy()) {
            case 'price-asc': return groupedList.sort((a, b) => productPrice(a) - productPrice(b));
            case 'price-desc': return groupedList.sort((a, b) => productPrice(b) - productPrice(a));
            case 'name': return groupedList.sort((a, b) => a.title.localeCompare(b.title));
            default: return groupedList;
        }
    });

    /* ── KPIs barra superior ── */
    totalInCart = computed(() => this.cart.totalUnits());

    /* ── Helpers ── */
    readonly CATEGORIES = CATEGORIES;
    readonly SIZES = SIZES;
    readonly productPrice = productPrice;
    readonly getImageUrl = getImageUrl;
    readonly formatPrice = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

    isInCart = (id: number) => this.cart.isInCart(id);

    private readonly destroy$ = new Subject<void>();
    private readonly search$ = new Subject<string>();

    constructor(
        private productSvc: ProductService,
        public cart: CartService,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit() {
        // Leer queryParams iniciales (category, size, y ahora 'q' desde el navbar)
        this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
            if (params['category']) this.activeCategory.set(params['category']);
            if (params['size']) this.activeSize.set(params['size']);
            
            // Escuchar el parámetro de búsqueda global 'q'
            if (params['q']) {
                this.searchQuery.set(params['q']);
            } else {
                this.searchQuery.set(''); // Limpia la búsqueda si se borra el parámetro de la URL
            }
        });

        // El resto de tu código de ngOnInit se mantiene igual...
        this.search$.pipe(
            debounceTime(350),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(q => this.searchQuery.set(q));

        this.loadProducts();
    }




    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        clearTimeout(this.toastTimer);
    }

    loadProducts(cursor?: string) {
        if (!cursor) { this.loading.set(true); this.allProducts.set([]); }
        else this.loadingMore.set(true);
        this.error.set('');

        this.productSvc.getProducts({ num: 48, cursor }).subscribe({
            next: res => {
                const incoming = res.products ?? [];
                this.allProducts.update(prev => cursor ? [...prev, ...incoming] : incoming);
                this.nextCursor.set(res.next_cursor);
                this.loading.set(false);
                this.loadingMore.set(false);
            },
            error: () => {
                this.error.set('No se pudieron cargar los productos. Verificá la conexión.');
                this.loading.set(false);
                this.loadingMore.set(false);
            }
        });
    }

    loadMore() {
        const cursor = this.nextCursor();
        if (cursor) this.loadProducts(cursor);
    }

    onSearch(q: string) { this.search$.next(q); }

    setCategory(cat: string) {
        this.activeCategory.set(this.activeCategory() === cat ? '' : cat);
    }

    setSize(size: string) {
        this.activeSize.set(this.activeSize() === size ? '' : size);
    }

    clearFilters() {
        this.searchQuery.set('');
        this.activeCategory.set('');
        this.activeSize.set('');
        this.sortBy.set('default');
    }

    addToCart(p: Product, e: Event) {
        e.preventDefault();
        e.stopPropagation();
        if (p.stock <= 0) return;
        this.cart.addItem(p);
        this.showToast(`"${p.title}" añadido al carrito`);
    }

    private showToast(msg: string) {
        clearTimeout(this.toastTimer);
        this.toastMsg.set(msg);
        this.toastTimer = setTimeout(() => this.toastMsg.set(''), 2500);
    }

    goToDetail(id: number) {
        this.router.navigate(['/products', id]);
    }
}
