import { Component, OnInit, signal, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms'; // necesario para usar ngModel en los inputs del Modal (Altura y Peso)
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { ProductImageService, ProductImage } from '../../services/product-image.service';
import { Product, productPrice, getImageUrl } from '../../models/product.model';
import { SizeGuideService, SizeGuide } from '../../services/size-guide.service';

@Component({
    standalone: true,
    selector: 'app-product-detail',
    imports: [CommonModule, RouterLink, FormsModule], 
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

    // variables de estado para el Calculador de Talles. 
    // usamos signal() porque Angular actualiza la pantalla solo cuando estas cambian
    isCalculatorOpen = signal(false); // Para abrir/cerrar el modal modal
    calculatorStep = signal(1);       // 1: Altura/Peso, 2: Calce, 3: Resultado
    isSizeGuideModalOpen = signal(false);
    userHeight = signal<number | null>(null);
    userWeight = signal<number | null>(null);
    fitPreference = signal<'ajustado' | 'normal' | 'suelto'>('normal');
    calculatedSize = signal<string | null>(null);
    categoryGuides = signal<SizeGuide[]>([]); // Acá se guardan las reglas que trae el backend

    colorDictionary: { [key: string]: string } = {
        'negro': '#000000',
        'blanco': '#ffffff',
        'gris': '#52555a',
        'azul': '#021944',
        'verde': '#104702',
        'beige': '#d6cbbd',
        'khaki': '#a89882',
        'rojo': '#e7070e',
        'rosa': '#f4c2c2',
        'amarillo': '#fbc02d'
    };

    availableColors = signal<any[]>([]);
    selectedColor = signal<any>(null);

    readonly productPrice = productPrice;
    readonly getImageUrl = getImageUrl;
    readonly formatPrice = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

    isInCart = () => {
        const p = this.product();
        return p ? this.cart.isInCart(p.id) : false;
    };

    private cdr = inject(ChangeDetectorRef);
    
    // inyectamos nuestro servicio de talles para hablar con la base de datos
    private sizeGuideSvc = inject(SizeGuideService);

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

                // cuando llega el producto, le pedimos al backend las reglas para su categoría.
                // Ej: Si el producto es categoría remeras, traemos la tabla de remeras.
                this.loadGuidesForThisProduct(p.category);

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
                    const variantList = vars ?? [];
                    this.variants.set(variantList);
                    
                    // logica de colores solo con los que hay en sotck
                    //  Juntamos el producto actual + todas sus variantes
                    const allProducts = [p, ...variantList]; 
                    
                    //  Filtramos solo los que tienen stock disponible
                    const inStockProducts = allProducts.filter(prod => prod.stock > 0);
                    
                    // extraemos los colores únicos para no repetir circulitos
                    const uniqueColorsMap = new Map();
                    inStockProducts.forEach(prod => {
                        if (prod.color) { // Si el producto tiene un color escrito en la base de datos
                            const colorName = prod.color.trim();
                            const colorKey = colorName.toLowerCase();
                            
                            if (!uniqueColorsMap.has(colorName)) {
                                uniqueColorsMap.set(colorName, {
                                    name: colorName,
                                    // Busca en el diccionario. Si no existe la palabra, pone gris por defecto.
                                    hex: this.colorDictionary[colorKey] || '#cccccc', 
                                    productId: prod.id
                                });
                            }
                        }
                    });
                    
                    const finalColors = Array.from(uniqueColorsMap.values());
                    this.availableColors.set(finalColors);
                    
                    // Autoseleccionar el color actual si está en stock. Si no, selecciona el primero que haya.
                    const currentProdColor = finalColors.find(c => c.name === p.color);
                    if (currentProdColor) {
                        this.selectedColor.set(currentProdColor);
                    } else if (finalColors.length > 0) {
                        this.selectedColor.set(finalColors[0]);
                    }
                    // -----------------------------------------------------

                    this.cdr.markForCheck();
                });
            },
            error: () => {
                this.error.set('No se pudo cargar el producto.');
                this.loading.set(false);
            }
        });
    }

    // bloque completo de funciones para el calculador de talles
    
    // pide las guías al backend y las guarda en el Signal "categoryGuides"
    loadGuidesForThisProduct(category: string) {
        this.sizeGuideSvc.getGuidesByCategory(category).subscribe({
            next: (guides) => this.categoryGuides.set(guides),
            error: (err) => console.error("Error cargando guías de talle:", err)
        });
    }

    openSizeGuideModal() {
        this.isSizeGuideModalOpen.set(true);
        document.body.style.overflow = 'hidden';
    }

    closeSizeGuideModal() {
        this.isSizeGuideModalOpen.set(false);
        document.body.style.overflow = '';
    }

    openCalculator() {
        this.isCalculatorOpen.set(true);
        this.calculatorStep.set(1);
        this.calculatedSize.set(null);
        document.body.style.overflow = 'hidden'; // Evita que se scrollee la página de fondo al tener el modal abierto
    }

    closeCalculator() {
        this.isCalculatorOpen.set(false);
        document.body.style.overflow = ''; // Devuelve el scroll a la normalidad
    }

    nextStep() {
        // Validación del Paso 1: No lo dejamos avanzar si no pone datos
        if (this.calculatorStep() === 1) {
            if (!this.userHeight() || !this.userWeight()) {
                alert('Por favor, ingresá tu altura y peso para continuar.');
                return;
            }
        }
        
        // Avanzamos al siguiente paso
        this.calculatorStep.update(s => s + 1);
        
        // Si llegó al paso 3 (resultado), ejecutamos la matemática
        if (this.calculatorStep() === 3) {
            this.calculateFinalSize();
        }
    }

    prevStep() {
        this.calculatorStep.update(s => s - 1);
    }

    setFitPreference(fit: 'ajustado' | 'normal' | 'suelto') {
        this.fitPreference.set(fit);
    }

    // La lógica central del recomendador
    calculateFinalSize() {
        const weight = this.userWeight()!;
        const height = this.userHeight()!;
        const guides = this.categoryGuides();

        if (guides.length === 0) {
            this.calculatedSize.set('Sin datos (El administrador aún no cargó la tabla para esta prenda)');
            return;
        }

        // Búsqueda en la base de datos para saber en que rango iria por el peso y altura
        let baseGuide = guides.find(g => 
            weight >= g.min_weight && weight <= g.max_weight &&
            height >= g.min_height && height <= g.max_height
        );

        if (!baseGuide) {
            this.calculatedSize.set('No pudimos encontrar un talle exacto para tus medidas. ¡Consultanos por WhatsApp!');
            return;
        }

        let finalSize = baseGuide.size;

        // movemos el talle para arriba o para abajo según prefiera el usuario
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
        let currentIndex = sizeOrder.indexOf(finalSize);

        if (this.fitPreference() === 'suelto' && currentIndex < sizeOrder.length - 1) {
            finalSize = sizeOrder[currentIndex + 1]; // Subir un talle
        } else if (this.fitPreference() === 'ajustado' && currentIndex > 0) {
            finalSize = sizeOrder[currentIndex - 1]; // Bajar un talle
        }

        this.calculatedSize.set(finalSize);
    }

    resetCalculator() {
        this.calculatorStep.set(1);
        this.userHeight.set(null);
        this.userWeight.set(null);
        this.fitPreference.set('normal');
        this.calculatedSize.set(null);
    }

    isTopClothing(category: string | undefined): boolean {
        if (!category) return true;
        const cat = category.toLowerCase();
        return cat.includes('remera') || cat.includes('buzo') || cat.includes('campera') || cat.includes('sweater') || cat.includes('top');
    }

    isBottomClothing(category: string | undefined): boolean {
        if (!category) return false;
        const cat = category.toLowerCase();
        return cat.includes('pantalon') || cat.includes('short') || cat.includes('bermuda') || cat.includes('jean');
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