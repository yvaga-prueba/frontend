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

/*const CATEGORIES = [
    'Remeras', 'Buzos', 'Pantalones', 'Gorras',
    'Camperas', 'Accesorios', 'Calzado'
];*/
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
    activeColor = signal('');
    activeGender = signal('');
    sortBy = signal<'default' | 'price-asc' | 'price-desc' | 'name'>('default');

    // filtros dinamicos, armamos con lo que hay en la bdd
    availableCategories = computed(() => {
        // Extrae las categorías, saca los vacíos, quita duplicados y los ordena A-Z
        const cats = this.allProducts().map(p => p.category).filter(Boolean);
        return [...new Set(cats)].sort();
    });

    availableGenders = computed(() => {
        // Extrae géneros (si un producto viejo no tiene, le pone Unisex por defecto)
        const genders = this.allProducts().map(p => p.gender || 'Unisex').filter(Boolean);
        return [...new Set(genders)].sort();
    });

    // Lista de colores 
    AVAILABLE_COLORS = [
        { name: 'Negro', hex: '#222222' },
        { name: 'Blanco', hex: '#FFFFFF' },
        { name: 'Gris', hex: '#9E9E9E' },
        { name: 'Azul', hex: '#1976D2' },
        { name: 'Rojo', hex: '#D32F2F' },
        { name: 'Verde', hex: '#388E3C' },
        { name: 'Amarillo', hex: '#FBC02D' },
        { name: 'Rosa', hex: '#F48FB1' },
        { name: 'Marron', hex: '#795548' },
        { name: 'Multicolor', hex: 'linear-gradient(45deg, #f32170, #ff6b08, #cf23cf, #eedd44)' }
    ];

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
    /* ── Computed: productos filtrados y ordenados (cliente) ── */
    filteredProducts = computed<ProductWithVariants[]>(() => {
        const q = this.searchQuery().toLowerCase().trim();
        const cat = this.activeCategory().toLowerCase();
        const size = this.activeSize();
        const color = this.activeColor().toLowerCase();
        const gender = this.activeGender().toLowerCase(); // <--- 1. CAPTURAMOS EL GÉNERO

        // agrupamos primero, para no perder ninguna variante
        const grouped = new Map<string, { main: Product, variants: Product[] }>();
        for (const p of this.allProducts()) {
            const key = p.title.toLowerCase().trim();
            if (!grouped.has(key)) {
                grouped.set(key, { main: p, variants: [p] });
            } else {
                const group = grouped.get(key)!;
                group.variants.push(p);
                // Si el main no tiene stock pero esta variante sí, la ponemos como cara visible
                if (p.stock > 0 && group.main.stock <= 0) {
                    group.main = p;
                }
            }
        }

        // Armamos la lista ya agrupada
        let groupedList: ProductWithVariants[] = Array.from(grouped.values()).map(g => {
            g.variants.sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size));
            return { ...g.main, variants: g.variants };
        });

        // Revisamos si el grupo cumple los requisitos (Filtros simples)
        if (q) {
            groupedList = groupedList.filter(g =>
                g.title.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
            );
        }

        if (cat) {
            groupedList = groupedList.filter(g => g.category.toLowerCase() === cat);
        }

        // <--- 2. APLICAMOS EL FILTRO POR GÉNERO AQUÍ --->
        if (gender) {
            groupedList = groupedList.filter(g => (g.gender || 'Unisex').toLowerCase() === gender);
        }

        // Filtros combinados de Talle y Color (Filtros en las variantes)
        if (size || color) {
            groupedList = groupedList.filter(g => {
                // Un producto pasa el filtro si alguna de sus variantes tiene el talle Y color buscado
                return g.variants.some(v => {
                    const matchSize = size ? v.size === size : true;
                    const matchColor = color ? v.color?.toLowerCase() === color : true;
                    return matchSize && matchColor;
                });
            });

            // Si el cliente eligió un color, hacemos que ese color sea la portada del producto
            if (color) {
                groupedList = groupedList.map(g => {
                    const variantOfColor = g.variants.find(v => v.color?.toLowerCase() === color && v.stock > 0)
                        || g.variants.find(v => v.color?.toLowerCase() === color);

                    if (variantOfColor) {
                        return { ...g, ...variantOfColor, variants: g.variants };
                    }
                    return g;
                });
            }
        }

        // ordenamos
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

    readonly SIZES = SIZES;
    readonly productPrice = productPrice;
    readonly getImageUrl = getImageUrl;
    readonly formatPrice = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

    isInCart = (id: number) => this.cart.isInCart(id);

// funcion que hace prural hombre y mujer 
    displayGender(g: string): string {
        if (g === 'Hombre') return 'Hombres';
        if (g === 'Mujer') return 'Mujeres';
        return g; // "Unisex" y el resto de cosas quedan exactamente igual
    }

    private readonly destroy$ = new Subject<void>();
    private readonly search$ = new Subject<string>();

    constructor(
        private productSvc: ProductService,
        public cart: CartService,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit() {
        // Leer queryParams iniciales (category, size, color, gender y 'q')
        this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
            if (params['category']) this.activeCategory.set(params['category']);
            else this.activeCategory.set('');

            if (params['size']) this.activeSize.set(params['size']);
            else this.activeSize.set('');

            if (params['color']) this.activeColor.set(params['color']);
            else this.activeColor.set('');


            if (params['gender']) this.activeGender.set(params['gender']);
            else this.activeGender.set('');

            if (params['q']) {
                this.searchQuery.set(params['q']);
            } else {
                this.searchQuery.set('');
            }
        });

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
        const newCat = this.activeCategory() === cat ? null : cat;
        this.router.navigate([], { queryParams: { category: newCat }, queryParamsHandling: 'merge' });
    }

    setSize(size: string) {
        const newSize = this.activeSize() === size ? null : size;
        this.router.navigate([], { queryParams: { size: newSize }, queryParamsHandling: 'merge' });
    }

    setColor(color: string) {
        const newColor = this.activeColor() === color ? null : color;
        this.router.navigate([], { queryParams: { color: newColor }, queryParamsHandling: 'merge' });
    }


    setGender(g: string) {
        const newGender = this.activeGender() === g ? null : g;
        this.router.navigate([], { queryParams: { gender: newGender }, queryParamsHandling: 'merge' });
    }

    clearFilters() {
        this.searchQuery.set('');
        this.activeCategory.set('');
        this.activeSize.set('');
        this.activeColor.set('');
        this.activeGender.set('');
        this.sortBy.set('default');


        this.router.navigate([], { queryParams: {} });
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