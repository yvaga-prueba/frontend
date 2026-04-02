import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject, ChangeDetectorRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { ProductImageService, ProductImage } from '../../services/product-image.service';
import { Product, productPrice, getImageUrl } from '../../models/product.model';
import { SizeGuideService, SizeGuide } from '../../services/size-guide.service';
import { FavoriteService } from '../../services/favorite.service';

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

    //guardamos la descripcion para todos los productos que tengan el mismo titulo
    sharedDescription = signal<string>('');

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

    // variables para los modales de seguridad y envio
    isShippingModalOpen = signal(false);
    isReturnPolicyModalOpen = signal(false);
    isSecurityModalOpen = signal(false);

    //descripcion
    isDescriptionOpen = signal(true);
    toggleDescription() {
        this.isDescriptionOpen.update(val => !val);
    }

    // divide la descripcion
    productDescriptionPoints = computed(() => {
        // Ahora usamos la descripción COMPARTIDA de todos los productos iguales
        const desc = this.sharedDescription();
        
        if (!desc) return [];

        return desc
            .split('\n')
            .map(point => point.trim())
            .filter(point => point.length > 0);
    });
   

    // Texto dinámico de entrega
    estimatedDelivery = signal('');

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

    // Inyectamos el servicio de favoritos
    private favoriteSvc = inject(FavoriteService);

    toggleFav(event: Event, productId: number) {
        event.preventDefault();
        event.stopPropagation();
        this.favoriteSvc.toggleFavorite(productId);
    }

    isFav(productId: number): boolean {
        return this.favoriteSvc.isFavorite(productId);
    }

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productSvc: ProductService,
        public cart: CartService,
        private productImageSvc: ProductImageService
    ) { }

    ngOnInit() {
        this.calculateDeliveryDates();

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
                    const allProducts = [p, ...variantList]; 

                    //descripcion compartida
                    // Buscamos el primer producto de esta familia que NO tenga la descripción vacía
                    const productWithDesc = allProducts.find(prod => prod.description && prod.description.trim() !== '');
                    
                    if (productWithDesc) {
                        this.sharedDescription.set(productWithDesc.description);
                    } else {
                        this.sharedDescription.set(''); // Si ninguno tiene, queda vacío
                    }
                   
                    // logica de colores
                    const uniqueColorsMap = new Map();
                    
                    // Juntamos todos los colores
                    allProducts.forEach(prod => {
                        if (prod.color) { 
                            const colorName = prod.color.trim();
                            const colorKey = colorName.toLowerCase();
                            
                            if (!uniqueColorsMap.has(colorName)) {
                                uniqueColorsMap.set(colorName, {
                                    name: colorName,
                                    hex: this.colorDictionary[colorKey] || '#cccccc', 
                                    productId: prod.id,
                                    hasStockInCurrentSize: false
                                });
                            }
                        }
                    });
                    
                    // Revisamos el stock en el talle actual
                    uniqueColorsMap.forEach((colorObj, colorName) => {
                        const prodInThisSizeAndColor = allProducts.find(prod => prod.color === colorName && prod.size === p.size);
                        
                        if (prodInThisSizeAndColor && prodInThisSizeAndColor.stock > 0) {
                            colorObj.productId = prodInThisSizeAndColor.id;
                            colorObj.hasStockInCurrentSize = true; 
                        } else {
                            const anyProdOfThisColor = allProducts.find(prod => prod.color === colorName);
                            if (anyProdOfThisColor) {
                                colorObj.productId = anyProdOfThisColor.id;
                            }
                            colorObj.hasStockInCurrentSize = false; 
                        }
                    });
                    
                    let finalColors = Array.from(uniqueColorsMap.values());

                   
                    const colorOrder = ['negro', 'blanco', 'gris', 'beige', 'khaki', 'azul', 'verde', 'rojo', 'rosa', 'amarillo'];
                    
                    finalColors.sort((a, b) => {
                        const indexA = colorOrder.indexOf(a.name.toLowerCase());
                        const indexB = colorOrder.indexOf(b.name.toLowerCase());
                        
                        // Si agregás un color nuevo a la tienda que no está en la lista de arriba, lo manda al final (99)
                        const weightA = indexA === -1 ? 99 : indexA;
                        const weightB = indexB === -1 ? 99 : indexB;
                        
                        return weightA - weightB;
                    });
                    // =======================================================

                    this.availableColors.set(finalColors);
                    
                    // Autoseleccionar el color actual
                    const currentProdColor = finalColors.find(c => c.name === p.color);
                    if (currentProdColor) {
                        this.selectedColor.set(currentProdColor);
                    } else if (finalColors.length > 0) {
                        this.selectedColor.set(finalColors[0]);
                    }

                    // logica de talles cruzados
                    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL']; 
                    const productsInThisColor = allProducts.filter(prod => prod.color === p.color);

                    const finalSizes = sizeOrder.map(sizeName => {
                        const realProduct = productsInThisColor.find(prod => prod.size.trim().toUpperCase() === sizeName);
                        if (realProduct) {
                            return realProduct; 
                        } else {
                            return {
                                ...p,
                                id: -1, 
                                size: sizeName,
                                stock: 0 // Fantasma sin stock para que se tache
                            } as Product;
                        }
                    });
                    
                    this.variants.set(finalSizes);
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

    // calculo de dias habiles
    calculateDeliveryDates() {
        // lista de feriados 2026 que todavia no pasaron al dia de la fecha
        // podemos agregar si nos olvidamos alguno

        const feriados = [
            '2026-04-02', // Veteranos de Malvinas / Jueves Santo
            '2026-04-03', // Viernes Santo
            '2026-05-01', // Día del Trabajador (Viernes)
            '2026-05-25', // Revolución de Mayo (Lunes)
            '2026-06-15', // Gral. Güemes (Cae 17, se traslada al Lunes 15)
            '2026-07-09', // Día de la Independencia (Jueves)
            '2026-08-17', // Gral. San Martín (Lunes)
            '2026-10-12', // Diversidad Cultural (Lunes)
            '2026-11-20', // Soberanía Nacional (Viernes)
            '2026-12-08', // Inmaculada Concepción (Martes)
            '2026-12-25', // Navidad (Viernes)
        ];

        // Función que revisa si una fecha cae en la lista de feriados
        const isHoliday = (date: Date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dateString = `${yyyy}-${mm}-${dd}`;

            return feriados.includes(dateString);
        };

        // Función que suma días saltando findes Y feriados
        const addBusinessDays = (startDate: Date, daysToAdd: number) => {
            let currentDate = new Date(startDate);
            let addedDays = 0;

            while (addedDays < daysToAdd) {
                currentDate.setDate(currentDate.getDate() + 1);
                const dayOfWeek = currentDate.getDay();

                // 0 es Domingo, 6 es Sábado
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                // Solo suma 1 día si NO es finde y NO es feriado
                if (!isWeekend && !isHoliday(currentDate)) {
                    addedDays++;
                }
            }
            return currentDate;
        };

        const today = new Date();
        const minDate = addBusinessDays(today, 2); // Mínimo 2 días hábiles reales
        const maxDate = addBusinessDays(today, 4); // Máximo 4 días hábiles reales

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        const minStr = minDate.toLocaleDateString('es-AR', options).replace('.', '');
        const maxStr = maxDate.toLocaleDateString('es-AR', options).replace('.', '');

        this.estimatedDelivery.set(`Entrega estimada: ${minStr} - ${maxStr}`);
    }

    // --- CONTROL DE MODALES ---
    openShippingModal() { this.isShippingModalOpen.set(true); document.body.style.overflow = 'hidden'; }
    closeShippingModal() { this.isShippingModalOpen.set(false); document.body.style.overflow = ''; }

    openReturnPolicyModal() { this.isReturnPolicyModalOpen.set(true); document.body.style.overflow = 'hidden'; }
    closeReturnPolicyModal() { this.isReturnPolicyModalOpen.set(false); document.body.style.overflow = ''; }

    openSecurityModal() { this.isSecurityModalOpen.set(true); document.body.style.overflow = 'hidden'; }
 
    closeSecurityModal() { this.isSecurityModalOpen.set(false); document.body.style.overflow = ''; }

    // --- FUNCIONES DE COMPARTIR ---
    getCurrentUrl(): string {
        // Chequeamos si estamos en el navegador para que no explote el servidor 
        if (typeof window !== 'undefined') {
            return window.location.href;
        }
        return '';
    }

    copyLink(e: Event) {
        e.preventDefault();
        // Solo intentamos copiar si estamos en el navegador del cliente
        if (typeof window !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showToast('¡Enlace copiado al portapapeles!');
            }).catch(() => {
                this.showToast('No se pudo copiar el enlace');
            });
        }
    }
    shareToInstagram(e: Event) {
        e.preventDefault();
        // Solo intentamos copiar si estamos en el navegador del cliente
        if (typeof window !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(() => {
                // Le avisamos al usuario 
                this.showToast('¡Link copiado! Pegalo en tu chat de Instagram.');
                
                // Esperamos 2 segundos para que llegue a leer el cartelito y le abrimos Instagram
                setTimeout(() => {
                    window.open('https://instagram.com', '_blank');
                }, 2000);
            }).catch(() => {
                this.showToast('No se pudo copiar el enlace');
            });
        }
    }

    
    onColorClick(e: Event, colorObj: any) {
        e.preventDefault();
        // Navega a ese color, tenga stock o no, para que el cliente vea el botón sin stock 
        this.router.navigate(['/products', colorObj.productId]);
    }

    onVariantClick(e: Event, variant: Product) {
        e.preventDefault();
        
        if (variant.id === -1) {
            // Si hace clic en un talle que literalmente no existe en la base de datos para este color
            this.showToast(`El talle ${variant.size} se encuentra agotado temporalmente.`);
            return;
        }
        
        // Si existe en la base de datos, navegamos a ese talle para que el botón diga "SIN STOCK"
        this.router.navigate(['/products', variant.id]);
    }
}