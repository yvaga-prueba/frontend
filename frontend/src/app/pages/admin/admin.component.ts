import {
    Component, OnInit, signal, computed, ChangeDetectionStrategy,
    inject, PLATFORM_ID, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminService, CreateProductPayload, BackendTicketSummary } from '../../services/admin.service';
import { TicketService, Ticket, TicketSummary } from '../../services/ticket.service';
import { ShippingService, ShippingTracking } from '../../services/shipping.service';
import { ProductImageService, ProductImage } from '../../services/product-image.service';
import { ActivityService, ClientActivity } from '../../services/activity.service';
import { DashboardStats } from '../../models/admin.model';
import { Product, getImageUrl } from '../../models/product.model';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { SizeGuideService, SizeGuide } from '../../services/size-guide.service';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

type AdminSection = 'dashboard' | 'pedidos' | 'ventas' | 'detalle-ventas' | 'productos' | 'actividad' | 'analiticas' | 'talles';

interface ActivityEvent {
    type: 'sale' | 'afip' | 'cancel' | 'stock' | 'product' | 'client' | 'admin';
    typeLabel: string;
    icon: string;
    title: string;
    subtitle: string;
    time: Date;
}


interface ExtendedTicket {
    id: number;
    ticket_number: string;
    status: string;
    payment_method: string;
    total: number;
    item_count: number;
    created_at: string;
    // AFIP
    invoice_type?: string | null;
    invoice_number?: string | null;
    cae?: string | null;
    cae_due_date?: string | null;
    // Shipping
    tracking_number?: string | null;

    // nuevos campos
    seller_name?: string;
    client_contact?: string;
    coupon_code?: string;
    client_name?: string;
    client_dni?: string;
    lines?: any[]; // para que funcione ticket.lines?.length
    subtotal: number;
    tax_amount: number;
}

@Component({
    standalone: true,
    selector: 'app-admin',
    imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe, ImageCropperComponent],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit {
    private auth = inject(AuthService);
    private adminSvc = inject(AdminService);
    private ticketSvc = inject(TicketService);
    private productImageSvc = inject(ProductImageService);
    private activitySvc = inject(ActivityService);
    private shippingSvc = inject(ShippingService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private sizeGuideSvc = inject(SizeGuideService);
    readonly getImageUrl = getImageUrl;

    /* ── Navigation ── */
    activeSection = signal<AdminSection>('dashboard');
    mobileMenuOpen = signal(false);

    /* ── User ── */
    user = computed(() => this.auth.currentUser());

    recordAdminActivity(action: string, metadata: any = {}) {
        const currentUser = this.user();
        const eventType = `admin_${action}`;
        const metaObj = {
            admin_user: currentUser?.email || 'admin',
            ...metadata
        };

        this.activitySvc.recordActivity(eventType, this.router.url, metaObj);

        // Optimistic UI update para que aparezca en el feed inmediatamente
        this.clientActivities.update(acts => [
            {
                id: Date.now(),
                event_type: eventType,
                path: this.router.url,
                metadata: JSON.stringify(metaObj),
                created_at: new Date().toISOString()
            },
            ...acts
        ]);
    }

    /* ── Estadísticas / Filtros ── */
    statsPeriod = signal<string>('month');
    customStartDate = signal<string>('');
    customEndDate = signal<string>('');
    public salesChart: any;

    /* ── Meta Mensual ── */
    monthlyGoal = signal<number>(1000000);
    editGoalValue = signal<number>(1000000);
    showGoalModal = signal(false);

    /* ── Datos ── */
    tickets = signal<ExtendedTicket[]>([]);
    rawSales = signal<BackendTicketSummary[]>([]);  // datos crudos del backend
    products = signal<Product[]>([]);
    clientActivities = signal<ClientActivity[]>([]);
    activities = signal<any[]>([]);

    bestCustomers = signal<{ name: string; total: number }[]>([]);
    bestProducts = signal<{ name: string; sales: number }[]>([]);
    bestSellers = signal<{ name: string; total: number }[]>([]);

    advancedStats = signal({ maxTicketId: 0, maxTicket: 0, maxTicketClient: '', maxTicketSeller: '', maxTicketLines: [] as any[], minTicket: 0, modeTicket: 0, upt: 0, peakTime: '', discountRate: 0, topCombo: '' });

    /* ── UI States ── */
    ticketsLoading = signal(false);
    ticketsError = signal('');
    productsLoading = signal(false);
    productsError = signal('');

    ticketFilter = signal('');
    productFilter = signal('');

    pedidoTab = signal<'todos' | 'pendientes' | 'pagados' | 'cancelados'>('todos');

    showAvgTicketModal = signal(false);
    showBestTicketModal = signal(false);

    /* ── Estado Ui Expandir Filas (Visualización Rápida) ── */
    expandedTicketId = signal<number | null>(null);

    toggleExpand(id: number) {
        // Si tocás el mismo que está abierto, lo cierra. Si tocás otro, lo abre.
        this.expandedTicketId.update(current => current === id ? null : id);
    }

    /* ── Estado Ui Detalle Ticket ── */
    selectedSaleTicket = signal<any | null>(null);
    modalLoading = signal<boolean>(false);
    shippingTracking = signal<ShippingTracking | null>(null);

    /* ── Estado Ui AFIP Modal ── */
    afipModalTicket = signal<ExtendedTicket | null>(null);

    openAfipModal(t: ExtendedTicket) { this.afipModalTicket.set(t); }
    closeAfipModal() { this.afipModalTicket.set(null); }

    // Modal de productos
    showProductModal = signal(false);
    editingProduct = signal<Product | null>(null);
    productForm = signal<Partial<CreateProductPayload>>({});
    productSaving = signal(false);
    productFormError = signal('');
    deletingProductId = signal<number | null>(null);

    // Modal de imágenes
    showImagesModal = signal(false);
    imagesProduct = signal<Product | null>(null);       // producto cuyos imágenes estamos gestionando
    productImages = signal<ProductImage[]>([]);          // imágenes actuales
    imagesLoading = signal(false);
    imagesError = signal('');
    imageUploading = signal(false);
    imageUploadError = signal('');
    imageDragOver = signal(false);                      // drag & drop state
    imagePreviewQueue = signal<{ file: File; preview: string }[]>([]); // archivos pendientes de subir

    // Dashboard KPIs
    stats = signal<DashboardStats>({
        totalSales: 0, totalOrders: 0, averageTicket: 0, salesGrowth: 0, ticketGrowth: 0,
        paymentMethods: { efectivo: 0, transferencia: 0, tarjeta: 0 },
        discounts: { totalAmount: 0, impactPercent: 0 },
        categoryStats: []
    });

    /* ── Computed ── */
    kpis = computed(() => {
        const t = this.tickets();
        const total = t.reduce((s, tk) => s + tk.total, 0);
        const paid = t.filter(tk => tk.status === 'paid' || tk.status === 'completed').length;
        const completed = t.filter(tk => tk.status === 'completed').length;
        const cancelled = t.filter(tk => tk.status === 'cancelled').length;
        const afip = t.filter(tk => !!tk.cae).length;
        return { count: t.length, total, paid, completed, cancelled, afip };
    });

    filteredTickets = computed(() => {
        const term = this.ticketFilter().toLowerCase();
        const tab = this.pedidoTab();

        // 1. Primero filtramos por la pestaña seleccionada (Estado en la Base de Datos)
        let filtered = this.tickets();
        if (tab === 'pendientes') {
            filtered = filtered.filter(t => t.status === 'pending');
        } else if (tab === 'pagados') {
            filtered = filtered.filter(t => t.status === 'paid' || t.status === 'completed');
        } else if (tab === 'cancelados') {
            filtered = filtered.filter(t => t.status === 'cancelled');
        }

        // 2. Después aplicamos el buscador de texto si escribimos
        if (term) {
            filtered = filtered.filter(t =>
                t.ticket_number.toLowerCase().includes(term) ||
                (t.client_name && t.client_name.toLowerCase().includes(term)) ||
                (t.client_contact && t.client_contact.toLowerCase().includes(term)) ||
                (t.payment_method && t.payment_method.toLowerCase().includes(term))
            );
        }

        return filtered;
    });

    detalleVentasTickets = computed(() => {
        const f = this.ticketFilter().toLowerCase();
        const cobradas = this.tickets().filter(t => t.status === 'paid' || t.status === 'completed');
        if (!f) return cobradas;
        return cobradas.filter(t =>
            t.ticket_number.toLowerCase().includes(f) ||
            (t.payment_method && t.payment_method.toLowerCase().includes(f))
        );
    });

    filteredProducts = computed(() => {
        const f = this.productFilter().toLowerCase().trim();
        if (!f) return this.products();

        // 1. Separamos la búsqueda por espacios. 
        // Ej: "verde L" se convierte en ["verde", "l"]
        const searchWords = f.split(/\s+/);

        return this.products().filter(p => {
            // 2. Juntamos toda la info del producto en una sola cadena de texto gigante
            const productData = [
                p.title,
                p.category,
                p.description,
                p.color,
                p.size,
                p.bar_code?.toString()
            ].join(' ').toLowerCase();

            // verifica que las palabras buscadas estan en cadena
            return searchWords.every(word => productData.includes(word));
        });
    });

    stockAlert = computed(() => this.products().filter(p => p.stock <= 5));
    stockAlertNames = computed(() => this.stockAlert().map(p => p.title).join(', '));

    // ── Actividad ──────────────────────────────────────────
    activityFilter = signal<string>('all');
    readonly activityFilters = [
        { key: 'all', icon: '🔍', label: 'Todo' },
        { key: 'sale', icon: '💰', label: 'Ventas' },
        { key: 'afip', icon: '🏛️', label: 'AFIP' },
        { key: 'cancel', icon: '❌', label: 'Cancelaciones' },
        { key: 'product', icon: '📦', label: 'Productos' },
        { key: 'client', icon: '👤', label: 'Clientes' },
        { key: 'admin', icon: '🛡️', label: 'Administrable' },
    ];

    activityFeed = computed<ActivityEvent[]>(() => {
        const events: ActivityEvent[] = [];

        // Eventos derivados de cada ticket
        for (const t of this.tickets()) {
            const date = new Date(t.created_at);
            if (t.status === 'paid' || t.status === 'completed') {
                events.push({
                    type: 'sale', typeLabel: 'Venta',
                    icon: '💰',
                    title: `Venta cobrada — ${t.ticket_number}`,
                    subtitle: `${t.payment_method.toUpperCase()} · $${t.total.toLocaleString('es-AR')}`,
                    time: date,
                });
            }
            if (t.cae) {
                events.push({
                    type: 'afip', typeLabel: 'AFIP',
                    icon: '🏛️',
                    title: `Factura electrónica emitida — ${t.invoice_number}`,
                    subtitle: `CAE: ${t.cae} · Vto. ${t.cae_due_date ?? '—'}`,
                    time: date,
                });
            }
            if (t.status === 'cancelled') {
                events.push({
                    type: 'cancel', typeLabel: 'Cancelación',
                    icon: '❌',
                    title: `Ticket cancelado — ${t.ticket_number}`,
                    subtitle: `Total: $${t.total.toLocaleString('es-AR')}`,
                    time: date,
                });
            }
        }

        // Eventos de stock bajo
        for (const p of this.stockAlert()) {
            events.push({
                type: 'product', typeLabel: 'Stock',
                icon: '⚠️',
                title: `Stock bajo: ${p.title}`,
                subtitle: `Solo quedan ${p.stock} unidades`,
                time: new Date(),
            });
        }

        // Eventos de clientes (frontend web)
        for (const act of this.clientActivities()) {
            let metadataInfo = '';
            let adminUser = '';
            try {
                const metadata = JSON.parse(act.metadata);
                if (metadata.admin_user) {
                    adminUser = metadata.admin_user;
                    delete metadata.admin_user;
                }
                const keys = Object.keys(metadata);
                if (keys.length > 0) {
                    metadataInfo = keys.map(k => `${k}: ${metadata[k]}`).join(' | ');
                }
            } catch (e) { }

            if (act.event_type.startsWith('admin_')) {
                const cleanType = act.event_type.replace('admin_', '').toUpperCase();
                events.push({
                    type: 'admin', typeLabel: 'Admin',
                    icon: '🛡️',
                    title: `${adminUser || 'Admin'} — ${cleanType}`,
                    subtitle: metadataInfo || `Ruta: ${act.path}`,
                    time: new Date(act.created_at)
                });
            } else {
                events.push({
                    type: 'client', typeLabel: 'Cliente',
                    icon: '👤',
                    title: act.event_type.toUpperCase(),
                    subtitle: `Ruta: ${act.path}${metadataInfo ? ` - ${metadataInfo}` : ''}`,
                    time: new Date(act.created_at)
                });
            }
        }

        // Ordenar por fecha desc
        return events.sort((a, b) => b.time.getTime() - a.time.getTime());
    });

    filteredActivity = computed(() => {
        const f = this.activityFilter();
        if (f === 'all') return this.activityFeed();
        return this.activityFeed().filter(e => e.type === f);
    });

    todayStats = computed(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTickets = this.tickets().filter(t => new Date(t.created_at) >= today);
        return {
            sales: todayTickets.filter(t => t.status === 'paid' || t.status === 'completed').length,
            afip: todayTickets.filter(t => !!t.cae).length,
            cancelled: todayTickets.filter(t => t.status === 'cancelled').length,
            revenue: todayTickets
                .filter(t => t.status === 'paid' || t.status === 'completed')
                .reduce((s, t) => s + t.total, 0),
        };
    });

    readonly statusLabel: Record<string, string> = {
        pending: 'Pendiente', paid: 'Pagado', completed: 'Completado', cancelled: 'Cancelado'
    };
    readonly statusClass: Record<string, string> = {
        pending: 'badge--pending', paid: 'badge--paid', completed: 'badge--completed', cancelled: 'badge--cancelled'
    };
    readonly SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

    ngOnInit() { this.loadInitialData(); }

    loadInitialData() {
        this.loadProducts();
        this.loadTickets();
        this.loadClientActivities();
        this.loadGoalFromDB();
        this.loadSizeGuides();

        this.activities.set([
            { id: 1, text: 'Panel de control iniciado', time: 'Ahora', color: 'green' }
        ]);
    }

    setSection(s: AdminSection) {
        this.activeSection.set(s);
        this.ticketFilter.set('');
        this.mobileMenuOpen.set(false);
        if (s === 'dashboard') setTimeout(() => this.calculateStats(), 200);
    }

    goToSales(term: string) {
        this.ticketFilter.set(term);
        this.activeSection.set('pedidos');
    }

    goToProducts(term: string) {
        this.productFilter.set(term);
        this.activeSection.set('productos');
    }

    loadClientActivities() {
        this.activitySvc.recordListRecent().subscribe(acts => this.clientActivities.set(acts || []));
    }


    loadGoalFromDB() {
        this.adminSvc.getMonthlyGoal().subscribe({
            next: (res) => {
                const num = Number(res.goal);
                this.monthlyGoal.set(num);
                this.editGoalValue.set(num);
            },
            error: (err) => console.error('Error cargando meta:', err)
        });
    }

    saveMonthlyGoal() {
        const val = this.editGoalValue();
        if (val <= 0) {
            alert('La meta debe ser mayor a $0');
            return;
        }

        // Lo mandamos a MySQL a través de Go
        this.adminSvc.setMonthlyGoal(val).subscribe({
            next: () => {
                this.monthlyGoal.set(val); // Actualiza la UI instantáneamente
                this.showGoalModal.set(false); // Cierra el modal
                this.recordAdminActivity('update_goal', { new_goal: val });
            },
            error: (err) => alert('Error al guardar en la base de datos')
        });
    }

    /* ── Carga de tickets desde backend ── */
    loadTickets() {
        this.ticketsLoading.set(true);
        this.ticketsError.set('');

        this.adminSvc.getAllSales().subscribe({
            next: (sales) => {
                // Mapeamos los datos del backend a nuestra interfaz ExtendedTicket
                const extended: ExtendedTicket[] = sales.map((s: any) => ({
                    id: s.id,
                    ticket_number: s.ticket_number || s.ticket_number,
                    status: s.status,
                    payment_method: s.payment_method || s.paymentMethod, // Soportamos ambas nomenclaturas
                    total: s.total,


                    // Usamos 'lines' que es lo que viene de la base de datos sincronizada
                    lines: s.items || [],
                    item_count: s.item_count || 0,

                    // campos nuevos a probar
                    seller_name: s.seller_name || 'Web',
                    client_name: s.client_name || 'Consumidor Final',
                    client_dni: s.client_dni || '',
                    client_contact: s.client_contact || '-',
                    coupon_code: s.coupon_code || '-',
                    subtotal: s.subtotal || s.total,
                    tax_amount: s.tax_amount || 0,
                    // ------------------------------

                    created_at: s.date instanceof Date ? s.date.toISOString() : (s.created_at || s.date),
                    invoice_type: s.invoice_type ?? null,
                    invoice_number: s.invoice_number ?? null,
                    cae: s.cae ?? null,
                    cae_due_date: s.cae_due_date ?? null,
                    tracking_number: s.tracking_number ?? null
                }));

                this.tickets.set(extended);
                this.calculateStats(sales as any);
                this.ticketsLoading.set(false);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error en loadTickets:', err);
                this.ticketsError.set('Error al cargar tickets. Verificá que el backend esté activo.');
                this.ticketsLoading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    /* ── Carga de productos ── */
    loadProducts() {
        this.productsLoading.set(true);
        this.adminSvc.getProducts().subscribe({
            next: res => {
                const safeProducts: Product[] = (res.products ?? []).map(p => ({
                    ...p,
                    bar_code: p.bar_code ?? 0,
                    unit_price: p.unit_price ?? 0,
                    price: p.unit_price ?? 0,
                    gender: p.gender || 'Unisex'
                }));
                this.products.set(safeProducts);
                this.productsLoading.set(false);
                this.cdr.markForCheck();
            },
            error: () => {
                this.productsError.set('Error al cargar productos.');
                this.productsLoading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    /* ── Stats del Dashboard ── */
    calculateStats(sales?: any[]) {
        const data = sales ?? (this.tickets() as any[]);
        if (!data || data.length === 0) {
            setTimeout(() => this.updateChart([]), 200);
            return;
        }

        const now = new Date();
        const periodStart = new Date();
        if (this.statsPeriod() === 'today') periodStart.setHours(0, 0, 0, 0);
        else if (this.statsPeriod() === 'week') { const d = now.getDay() || 7; periodStart.setDate(now.getDate() - (d - 1)); periodStart.setHours(0, 0, 0, 0); }
        else if (this.statsPeriod() === 'month') periodStart.setDate(1);
        else if (this.statsPeriod() === 'year') { periodStart.setMonth(0, 1); periodStart.setHours(0, 0, 0, 0); }

        const validSales = data.filter((s: any) => {
            const date = s.date instanceof Date ? s.date : new Date(s.date ?? s.created_at);
            const paid = s.status === 'paid' || s.status === 'completed';
            return paid && date >= periodStart;
        });

        const totalSales = validSales.reduce((acc: number, s: any) => acc + s.total, 0);
        const totalOrders = validSales.length;

        // Desglose por medio de pago
        const counts = { cash: 0, card: 0, transfer: 0, total: validSales.length || 1 };
        validSales.forEach((s: any) => {
            const pm = (s.paymentMethod ?? s.payment_method ?? '').toLowerCase();
            if (pm === 'cash' || pm === 'efectivo') counts.cash++;
            else if (pm === 'card' || pm === 'tarjeta') counts.card++;
            else if (pm === 'transfer' || pm === 'transferencia') counts.transfer++;
        });

        this.stats.set({
            totalSales,
            totalOrders,
            averageTicket: totalOrders > 0 ? totalSales / totalOrders : 0,
            salesGrowth: 0,
            ticketGrowth: 0,
            paymentMethods: {
                efectivo: Math.round((counts.cash / counts.total) * 100),
                tarjeta: Math.round((counts.card / counts.total) * 100),
                transferencia: Math.round((counts.transfer / counts.total) * 100),
            },
            discounts: { totalAmount: 0, impactPercent: 0 },
            categoryStats: []
        });

        // --- NUEVA LÓGICA DE TICKET PROMEDIO Y RÉCORD ---
        let maxTkt: any = null;
        let totalItemsSold = 0;

        validSales.forEach((s: any) => {
            // Buscamos la mejor venta
            if (!maxTkt || s.total > maxTkt.total) {
                maxTkt = s;
            }
            // Sumamos las prendas para el UPT (Unidades por Ticket)
            if (s.lines && Array.isArray(s.lines)) {
                totalItemsSold += s.lines.reduce((sum: number, l: any) => sum + l.quantity, 0);
            } else {
                totalItemsSold += (s.item_count || 0);
            }
        });

        // Calculamos el UPT
        const upt = validSales.length > 0 ? (totalItemsSold / validSales.length) : 0;

        this.advancedStats.set({
            maxTicketId: maxTkt?.id || 0,
            maxTicket: maxTkt?.total || 0,
            maxTicketClient: maxTkt?.client_name !== 'Consumidor Final' ? (maxTkt?.client_name || maxTkt?.client_contact) : (maxTkt?.client_contact || 'Anónimo'),
            maxTicketSeller: maxTkt?.seller_name || 'Venta Web',


            maxTicketLines: maxTkt?.lines || [],

            upt: upt,

            minTicket: 0,
            modeTicket: 0,
            peakTime: '',
            discountRate: 0,
            topCombo: ''
        });

        // Rankins
        const sellersMap = new Map<string, number>();
        const clientsMap = new Map<string, number>();
        const productsMap = new Map<string, number>();

        validSales.forEach((s: any) => {
            // 1. Mejores Vendedores
            const seller = s.seller_name && s.seller_name !== '-' ? s.seller_name : 'Venta Web';
            sellersMap.set(seller, (sellersMap.get(seller) || 0) + s.total);

            // 2. Clientes VIP (usamos nombre o contacto)
            const client = s.client_name && s.client_name !== 'Consumidor Final' ? s.client_name : (s.client_contact || 'Anónimo');
            if (client !== '-' && client !== 'Anónimo') {
                clientsMap.set(client, (clientsMap.get(client) || 0) + s.total);
            }

            // 3. Mejores Productos (contamos unidades vendidas en las líneas del ticket)
            if (s.lines && Array.isArray(s.lines)) {
                s.lines.forEach((line: any) => {
                    const pName = line.product_title || line.name || 'Producto';
                    productsMap.set(pName, (productsMap.get(pName) || 0) + line.quantity);
                });
            }
        });

        // Actualizamos los arrays ordenándolos de mayor a menor (SIN LÍMITES)
        this.bestSellers.set(
            Array.from(sellersMap.entries())
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total)
        );

        this.bestCustomers.set(
            Array.from(clientsMap.entries())
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total)
        );

        this.bestProducts.set(
            Array.from(productsMap.entries())
                .map(([name, sales]) => ({ name, sales }))
                .sort((a, b) => b.sales - a.sales)
        );

        // --- FIN LÓGICA DE RANKINGS ---

        setTimeout(() => this.updateChart(validSales), 200); // <-- LE PASAMOS LAS VENTAS ACÁ
        this.cdr.markForCheck();
    }

    /* ── Gráfico ── */
    /* ── Gráfico Dinámico desde la BDD ── */
    updateChart(validSales: any[] = []) {
        if (!isPlatformBrowser(this.platformId)) return;
        const canvas = document.getElementById('salesChart') as HTMLCanvasElement;
        if (!canvas) return;
        if (this.salesChart) this.salesChart.destroy();

        let labels: string[] = [];
        let data: number[] = [];

        if (validSales.length === 0) {
            labels = ['Sin ventas'];
            data = [0];
        } else {
            // Agrupamos las ventas reales por día (Ej: "14/03")
            const grouped = new Map<string, number>();

            // Ordenamos de la más vieja a la más nueva para que el gráfico vaya hacia adelante
            const sortedSales = [...validSales].sort((a, b) => {
                const dateA = a.date instanceof Date ? a.date : new Date(a.date ?? a.created_at);
                const dateB = b.date instanceof Date ? b.date : new Date(b.date ?? b.created_at);
                return dateA.getTime() - dateB.getTime();
            });

            sortedSales.forEach(s => {
                const d = s.date instanceof Date ? s.date : new Date(s.date ?? s.created_at);
                const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                grouped.set(dateStr, (grouped.get(dateStr) || 0) + s.total);
            });

            labels = Array.from(grouped.keys());
            data = Array.from(grouped.values());
        }

        this.salesChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ingresos del día ($)',
                    data: data,
                    borderColor: '#e7070e',
                    backgroundColor: 'rgba(231, 7, 14, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    /* ── Gestión de Tickets / Pedidos ── */
    completeTicket(id: number) {
        this.adminSvc.completeTicket(id).subscribe({
            next: () => this.loadTickets(),
            error: (err) => alert('Error al completar el ticket: ' + (err?.error?.message ?? 'Error desconocido'))
        });
    }

    markAsPaid(ticket: any) {
        if (!confirm(`¿Confirmás que el pedido #${ticket.ticket_number} ya fue pagado?`)) return;

        // Por ahora usamos completeTicket, ajustamos si hace falta un endpoint específico en Go
        this.adminSvc.completeTicket(ticket.id).subscribe({
            next: () => {
                this.recordAdminActivity('mark_paid', { ticket_number: ticket.ticket_number });
                this.loadTickets(); // Recargamos la base de datos para ver el botón en verde
            },
            error: (err) => alert('Error al registrar el pago: ' + (err?.error?.message ?? 'Error desconocido'))
        });
    }

    cancelTicket(id: number) {
        if (!confirm('¿Cancelar este ticket? Esta acción restaura el stock.')) return;
        this.adminSvc.cancelTicket(id).subscribe({
            next: () => this.loadTickets(),
            error: (err) => alert('Error al cancelar el ticket: ' + (err?.error?.message ?? 'Error desconocido'))
        });
    }

    // Abre el modal cargando el detalle completo (con líneas) desde /api/tickets/:id
    openSaleTicket(ticketId: number) {
        this.modalLoading.set(true);
        // Limpiamos el modal antes de abrir para que no parpadee info vieja
        this.selectedSaleTicket.set({ id: ticketId, ticket_number: 'Cargando...', lines: [], total: 0 });
        this.cdr.markForCheck();

        this.ticketSvc.getTicketById(ticketId).subscribe({
            next: (ticket: any) => {
                // Rescatamos los datos base que ya tenemos en la tabla
                const base = this.tickets().find(t => t.id === ticketId);

                this.selectedSaleTicket.set({
                    ...ticket,
                    payment_method: ticket.payment_method ?? base?.payment_method,
                    invoice_type: ticket.invoice_type ?? base?.invoice_type,
                    invoice_number: ticket.invoice_number ?? base?.invoice_number,
                    cae: ticket.cae ?? base?.cae,
                    cae_due_date: ticket.cae_due_date ?? base?.cae_due_date,


                    seller_name: ticket.seller_name || base?.seller_name || 'Venta Web',
                    client_name: ticket.client_name || base?.client_name || 'Consumidor Final',
                    client_dni: ticket.client_dni || base?.client_dni || '',
                    client_contact: ticket.client_contact || base?.client_contact || '',
                    coupon_code: ticket.coupon_code || base?.coupon_code || null,
                    subtotal: ticket.subtotal || base?.subtotal || ticket.total,
                    tax_amount: ticket.tax_amount || base?.tax_amount || 0,

                    // pasamos las prendas vendidas directamente a la variable "lines"
                    lines: ticket.lines && ticket.lines.length > 0 ? ticket.lines : (base?.lines || [])
                });

                this.modalLoading.set(false);
                this.cdr.markForCheck();
            },
            error: () => {
                this.modalLoading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    closeSaleTicket() {
        this.selectedSaleTicket.set(null);
    }

    selectedTrackingTicket = signal<any | null>(null);

    openTrackingModal(ticket: any) {
        this.selectedTrackingTicket.set(ticket);
        this.shippingTracking.set(null);

        if (ticket.tracking_number) {
            this.modalLoading.set(true);
            this.shippingSvc.getTrackingInfo(ticket.tracking_number).subscribe({
                next: (tracking) => {
                    this.shippingTracking.set(tracking);
                    this.modalLoading.set(false);
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.modalLoading.set(false);
                    this.cdr.markForCheck();
                }
            });
        }
    }

    closeTrackingModal() {
        this.selectedTrackingTicket.set(null);
        this.shippingTracking.set(null);
    }

    saveTracking(trackingNumber: string) {
        const ticketId = this.selectedTrackingTicket()?.id;
        if (!ticketId || !trackingNumber.trim()) return;

        this.adminSvc.updateTrackingNumber(ticketId, trackingNumber.trim()).subscribe({
            next: () => {
                this.recordAdminActivity('update_tracking', { ticket_id: ticketId, tracking: trackingNumber.trim() });
                alert('Seguimiento cargado correctamente.');

                // Actualizamos la tabla de pedidos
                const currentTicket = this.tickets().find(t => t.id === ticketId);
                if (currentTicket) {
                    currentTicket.tracking_number = trackingNumber.trim();
                }

                // Recargar el modal
                this.openTrackingModal({ ...this.selectedTrackingTicket(), tracking_number: trackingNumber.trim() });
            },
            error: () => alert('Error al cargar el seguimiento')
        });
    }


    // Para la tabla de ventas: URL de verificación AFIP con todos los params posibles
    buildAfipUrl(t: ExtendedTicket): string {
        if (!t.cae || !t.invoice_number) return '';
        const [ptovta, nrocomp] = t.invoice_number.split('-');
        const cuit = '20335645856';
        const importe = t.total?.toFixed(2) ?? '';
        const fecha = t.created_at
            ? new Date(t.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';
        return `https://servicioscf.afip.gob.ar/publico/comprobantes/cae.aspx`
            + `?cuit=${cuit}&cae=${t.cae}`
            + `&nroComp=${nrocomp}&ptoVta=${ptovta}&tipComp=11`
            + `&importe=${importe}&fecha=${fecha}&docRec=99&nroDoc=0`;
    }

    openWhatsapp() {
        const sale = this.selectedSaleTicket();
        if (!sale) return;

        this.recordAdminActivity('contact_client', { ticket_number: sale.ticket_number });

        const url = `https://wa.me/5493412557667?text=${encodeURIComponent(`¡Hola! Te escribimos de YVAGA 🖤 respecto a tu orden #${sale.ticket_number}.`)}`;
        window.open(url, '_blank');
    }

    getAfipInvoiceUrl(): string {
        const sale = this.selectedSaleTicket();
        if (!sale?.cae || !sale?.invoice_number) return '';
        const [ptovta, nrocomp] = (sale.invoice_number as string).split('-');
        const cuit = '20335645856';
        const importe = sale.total?.toFixed(2) ?? '';
        const fecha = sale.created_at
            ? new Date(sale.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';
        return `https://servicioscf.afip.gob.ar/publico/comprobantes/cae.aspx`
            + `?cuit=${cuit}&cae=${sale.cae}`
            + `&nroComp=${nrocomp}&ptoVta=${ptovta}&tipComp=11`
            + `&importe=${importe}&fecha=${fecha}&docRec=99&nroDoc=0`;
    }

    copiedField = signal<string>('');

    /** Formatea una fecha para copiarla al portapapeles — los pipes no se pueden usar en (click) */
    formatDate(date: string | Date | null | undefined): string {
        if (!date) return '';
        return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }


    /** Obtiene una parte del número de factura (0001-00000001) */
    getInvoicePart(invoiceNumber: string | null | undefined, part: 'pto' | 'nro'): string {
        if (!invoiceNumber) return '';
        const parts = invoiceNumber.split('-');
        if (part === 'pto') return parts[0] || '0001';
        return parts[1] || '';
    }

    copyToClipboard(value: string, label: string) {
        navigator.clipboard.writeText(value).then(() => {
            this.copiedField.set(label);
            setTimeout(() => this.copiedField.set(''), 1800);
        });
    }

    /* ── Exportar CSV ── */
    exportSalesToCSV() {
        const data = this.detalleVentasTickets().map(t => ({
            'N° Ticket': t.ticket_number,
            'Medio de Pago': t.payment_method,
            'Estado': t.status,
            'Total ($)': t.total,
            'Factura': t.invoice_number ?? '-',
            'CAE': t.cae ?? '-',
            'Fecha': new Date(t.created_at).toLocaleDateString('es-AR')
        }));

        if (data.length === 0) { alert('No hay datos para exportar.'); return; }

        const headers = Object.keys(data[0]);
        const sep = ';';
        const csvRows = data.map(row => headers.map(k => `"${(row as any)[k]}"`).join(sep));
        const csvString = '\uFEFF' + [headers.join(sep), ...csvRows].join('\r\n');

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `YVAGA_Ventas_${new Date().toLocaleDateString('es-AR')}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /* ── CRUD de Productos ── */
    openCreateProduct() {
        this.editingProduct.set(null);
        // ACÁ AGREGAMOS gender: 'Unisex' AL FINAL
        this.productForm.set({ size: 'M', stock: 0, unit_price: 0, bar_code: 0, color: '', gender: 'Unisex' });
        this.productFormError.set('');
        this.showProductModal.set(true);
    }

    openEditProduct(p: Product) {
        this.editingProduct.set(p);
        this.productForm.set({
            bar_code: p.bar_code,
            title: p.title,
            description: p.description,
            stock: p.stock,
            size: p.size,
            color: p.color || '',
            gender: p.gender || 'Unisex',
            category: p.category,
            unit_price: p.unit_price ?? p.price
        });
        this.productFormError.set('');
        this.showProductModal.set(true);
    }

    closeProductModal() { this.showProductModal.set(false); }

    saveProduct() {
        const form = this.productForm();
        if (!form.title || !form.unit_price) {
            this.productFormError.set('El título y el precio son requeridos.');
            return;
        }

        // validacion de precio
        const titleToMatch = form.title.trim().toLowerCase();
        const editingId = this.editingProduct()?.id;

        // Buscamos si ya existe otra prenda con el mismo nombre exacto
        const matchingProduct = this.products().find(p => 
            p.title.trim().toLowerCase() === titleToMatch && p.id !== editingId
        );

        if (matchingProduct) {
            const existingPrice = matchingProduct.unit_price ?? matchingProduct.price;
            
            // Si el precio de la base de datos es distinto tira este mje
            if (existingPrice !== form.unit_price) {
                const userConfirmed = confirm(
                    `¡CUIDADO! ⚠️\n\n` +
                    `Ya tenés un producto llamado "${matchingProduct.title}" cargado con un precio de $${existingPrice}.\n\n` +
                    `Estás intentando guardar este a $${form.unit_price}.\n` +
                    `Para que la tienda agrupe bien los colores, las variantes del mismo modelo deberían tener el mismo precio.\n\n` +
                    `¿Estás seguro de que querés guardarlo con este precio distinto? (Tocá CANCELAR para corregirlo)`
                );
                
                if (!userConfirmed) {
                    return; // Frenamos el guardado para que pueda corregir el número
                }
            }
        }
        // fin de validacion de precio

        this.productSaving.set(true);
        const editing = this.editingProduct();
        const payload = form as CreateProductPayload;

        const obs = editing
            ? this.adminSvc.updateProduct(editing.id, payload)
            : this.adminSvc.createProduct(payload);

        obs.subscribe({
            next: () => {
                this.recordAdminActivity(editing ? 'update_product' : 'create_product', {
                    product_id: editing?.id || 'new',
                    title: payload.title
                });

                this.productSaving.set(false);
                this.showProductModal.set(false);
                this.loadProducts();
            },
            error: (err) => {
                this.productSaving.set(false);
                this.productFormError.set(err?.error?.message ?? 'Error al guardar el producto.');
                this.cdr.markForCheck();
            }
        });
    }

    confirmDeleteProduct(id: number) { this.deletingProductId.set(id); }
    cancelDelete() { this.deletingProductId.set(null); }

    deleteProduct(id: number) {
        this.adminSvc.deleteProduct(id).subscribe({
            next: () => {
                this.recordAdminActivity('delete_product', { product_id: id });
                this.deletingProductId.set(null);
                this.loadProducts();
            },
            error: (err) => { alert('Error al eliminar: ' + (err?.error?.message ?? 'Error desconocido')); }
        });
    }

    updateFormField(field: string, value: any) {
        this.productForm.update(f => ({ ...f, [field]: value }));
    }

    logout() { this.auth.logout(); this.router.navigate(['/']); }

    /* ── Gestión de Imágenes de Producto ── */

    openImagesModal(p: Product) {
        this.imagesProduct.set(p);
        this.productImages.set([]);
        this.imagePreviewQueue.set([]);
        this.imagesError.set('');
        this.imageUploadError.set('');
        this.showImagesModal.set(true);
        this.loadProductImages(p.id);
    }

    closeImagesModal() {
        this.showImagesModal.set(false);
        this.imagesProduct.set(null);
        this.imagePreviewQueue.set([]);
        this.imageToCrop.set(null);
    }

    loadProductImages(productId: number) {
        this.imagesLoading.set(true);
        this.imagesError.set('');
        this.productImageSvc.getImages(productId).subscribe({
            next: imgs => {
                this.productImages.set(imgs ?? []);
                this.imagesLoading.set(false);
                this.cdr.markForCheck();
            },
            error: () => {
                this.imagesError.set('No se pudieron cargar las imágenes.');
                this.imagesLoading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    /* ── Estado del Cropper ── */
    imageToCrop = signal<File | null>(null);
    imageChangedEvent: any = '';
    croppedImage = signal<Blob | null>(null);

    onImageFilesSelected(event: any) {
        if (event.target.files && event.target.files.length > 0) {
            this.handleSelectedFile(event.target.files[0], event);
        }
        event.target.value = '';
    }

    onImageDrop(event: DragEvent) {
        event.preventDefault();
        this.imageDragOver.set(false);
        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            this.handleSelectedFile(event.dataTransfer.files[0]);
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        this.imageDragOver.set(true);
    }

    onDragLeave() {
        this.imageDragOver.set(false);
    }

    private handleSelectedFile(file: File, changeEvent?: any) {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowed.includes(file.type)) {
            this.imageUploadError.set('Solo se aceptan imágenes JPG, PNG, GIF o WEBP.');
            return;
        }
        this.imageUploadError.set('');

        // Use only the File object for the cropper to avoid input conflicts
        this.imageToCrop.set(file);
        this.imageChangedEvent = null;

        this.cdr.markForCheck();
    }

    imageCropped(event: ImageCroppedEvent) {
        if (event.blob) {
            this.croppedImage.set(event.blob);
        }
    }

    cancelCrop() {
        this.imageToCrop.set(null);
        this.croppedImage.set(null);
        this.imageChangedEvent = '';
    }

    acceptCrop() {
        const blob = this.croppedImage();
        const originalFile = this.imageToCrop();

        if (!blob || !originalFile) return;

        // Make it a File object
        const croppedFile = new File([blob], originalFile.name, { type: 'image/jpeg' });

        const preview = URL.createObjectURL(croppedFile);
        this.imagePreviewQueue.update(q => [...q, { file: croppedFile, preview }]);

        this.imageToCrop.set(null);
        this.croppedImage.set(null);
        this.imageChangedEvent = '';
        this.cdr.markForCheck();
    }

    removeFromQueue(index: number) {
        const q = this.imagePreviewQueue();
        URL.revokeObjectURL(q[index].preview);
        this.imagePreviewQueue.update(list => list.filter((_, i) => i !== index));
    }

    uploadQueuedImages() {
        const product = this.imagesProduct();
        const queue = this.imagePreviewQueue();
        if (!product || queue.length === 0) return;

        this.imageUploading.set(true);
        this.imageUploadError.set('');

        const existingCount = this.productImages().length;
        let completed = 0;
        let failed = 0;

        queue.forEach((item, i) => {
            const isPrimary = existingCount === 0 && i === 0;
            const position = existingCount + i;
            this.productImageSvc.uploadImage(product.id, item.file, isPrimary, position).subscribe({
                next: () => {
                    completed++;
                    if (completed + failed === queue.length) {
                        this.imageUploading.set(false);
                        this.imagePreviewQueue.set([]);
                        if (failed > 0) this.imageUploadError.set(`${failed} imagen(es) no pudieron subirse.`);
                        this.loadProductImages(product.id);
                    }
                },
                error: () => {
                    failed++;
                    completed++;
                    if (completed === queue.length) {
                        this.imageUploading.set(false);
                        this.imageUploadError.set(`${failed} imagen(es) no pudieron subirse.`);
                        this.loadProductImages(product.id);
                    }
                }
            });
        });
    }

    deleteProductImage(imageId: number) {
        const product = this.imagesProduct();
        if (!product) return;
        this.productImageSvc.deleteImage(product.id, imageId).subscribe({
            next: () => this.loadProductImages(product.id),
            error: () => this.imageUploadError.set('Error al eliminar la imagen.')
        });
    }

    moveProductImage(index: number, direction: -1 | 1) {
        const product = this.imagesProduct();
        if (!product) return;

        const imgs = [...this.productImages()];
        if (index + direction < 0 || index + direction >= imgs.length) return;

        // Swap in array
        const temp = imgs[index];
        imgs[index] = imgs[index + direction];
        imgs[index + direction] = temp;

        // Update local state optimistic
        this.productImages.set(imgs);

        // Update server
        const ids = imgs.map(img => img.id);
        this.productImageSvc.reorderImages(product.id, ids).subscribe({
            error: () => {
                this.imageUploadError.set('Error al guardar el nuevo orden.');
                this.loadProductImages(product.id); // Rollback on error
            }
        });
    }
    verDetalleTicket(ticket: any) {
        console.log('Viendo detalle del ticket:', ticket);
    }

    openBestTicketModal() {
        const ticketId = this.advancedStats().maxTicketId;
        if (!ticketId) {
            alert('No hay ventas registradas en este periodo.');
            return;
        }

        // 1. Abre el modal
        this.showBestTicketModal.set(true);

        // 2. Va a la base de datos a buscar las prendas exactas de esa venta
        this.ticketSvc.getTicketById(ticketId).subscribe({
            next: (fullTicket: any) => {
                const items = fullTicket.lines || fullTicket.items || [];

                // 3. Le inyecta las prendas al modal
                this.advancedStats.update(stats => ({
                    ...stats,
                    maxTicketLines: items
                }));
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error al cargar detalle de mejor venta:', err)
        });
    }

    // --- NUEVAS FUNCIONES DE LA BOTONERA DE PEDIDOS ---

    // 1. Abre el WhatsApp ya con un mensaje prearmado para el cliente
    contactarCliente(ticket: any) {
        const telefono = ticket.client_contact || '';
        // Limpiamos el número por si tiene guiones o espacios
        const numLimpio = telefono.replace(/\D/g, '');

        let url = `https://wa.me/549${numLimpio}?text=${encodeURIComponent(`¡Hola! Te escribimos de YVAGA 🖤 respecto a tu pedido #${ticket.ticket_number}.`)}`;

        // Si no detecta un número, abre WhatsApp Web normal para que lo busques manual
        if (numLimpio.length < 8) url = `https://web.whatsapp.com/`;

        window.open(url, '_blank');
    }

    // 2. Genera una etiqueta en tamaño mercadolibre
    imprimirEtiqueta(ticket: any) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>Etiqueta de Envío - #${ticket.ticket_number}</title>
                    <style>
                        /* Tamaño estándar de etiqueta térmica (10x15 cm) */
                        @page { size: 100mm 150mm; margin: 0; }
                        
                        body { 
                            font-family: 'Arial', sans-serif; 
                            margin: 0; 
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            background: #555; /* Fondo gris solo para previsualizar en PC */
                        }
                        
                        .etiqueta { 
                            width: 100mm; 
                            height: 148mm; 
                            background: white;
                            padding: 6mm;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            /* Borde simulado para hojas A4 */
                            border: 1px dashed #ccc; 
                        }
                        
                        /* ENCABEZADO */
                        .header {
                            border-bottom: 3px solid #000;
                            padding-bottom: 8px;
                            margin-bottom: 10px;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                        }
                        .brand { font-size: 26px; font-weight: 900; letter-spacing: 1px; margin: 0;}
                        .fecha { font-size: 10px; color: #000; font-weight: bold;}
                        
                        /* CAJAS DE DATOS */
                        .seccion {
                            border: 2px solid #000;
                            border-radius: 6px;
                            padding: 10px;
                            margin-bottom: 10px;
                            position: relative;
                        }
                        .seccion-titulo {
                            font-size: 11px;
                            text-transform: uppercase;
                            font-weight: 900;
                            background: #000;
                            color: #fff;
                            display: inline-block;
                            padding: 3px 8px;
                            position: absolute;
                            top: -2px;
                            left: -2px;
                            border-bottom-right-radius: 6px;
                        }
                        
                        .texto-remitente { font-size: 12px; line-height: 1.5; margin-top: 15px; }
                        
                        .texto-destinatario { font-size: 16px; line-height: 1.2; font-weight: bold; margin-top: 15px; text-transform: uppercase;}
                        .dest-detalle { font-size: 12px; font-weight: normal; margin-top: 8px; line-height: 1.6;}
                        
                        /* LÍNEAS PARA COMPLETAR A MANO */
                        .linea-puntos { 
                            border-bottom: 1px solid #000; 
                            margin: 15px 0 5px 0; 
                            width: 100%; 
                            height: 5px; 
                        }

                        /* CÓDIGO DE BARRAS Y PIE */
                        .barcode-container {
                            text-align: center;
                            margin-top: auto;
                            padding-top: 10px;
                        }
                        .barcode-img {
                            max-width: 90%;
                            height: 55px;
                        }
                        .ticket-num {
                            font-size: 16px;
                            font-weight: 900;
                            letter-spacing: 1px;
                            margin-top: 5px;
                        }
                        .peso-bultos {
                            display: flex;
                            justify-content: space-between;
                            font-size: 12px;
                            font-weight: bold;
                            margin-top: 10px;
                            border-top: 2px dashed #000;
                            padding-top: 8px;
                        }
                        
                        /* Al imprimir, sacamos el fondo gris */
                        @media print {
                            body { background: white; }
                            .etiqueta { border: none; }
                        }
                    </style>
                </head>
                <body onload="setTimeout(() => { window.print(); window.close(); }, 800)">
                    <div class="etiqueta">
                        
                        <div class="header">
                            <h1 class="brand">YVAGA.</h1>
                            <div class="fecha">EMISIÓN: ${new Date().toLocaleDateString('es-AR')}</div>
                        </div>

                        <div class="seccion" style="flex-grow: 1;">
                            <div class="seccion-titulo">Destinatario</div>
                            <div class="texto-destinatario">
                                👤 ${ticket.client_name || 'Consumidor Final'}
                            </div>
                            <div class="dest-detalle">
                                <strong>📞 Tel:</strong> ${ticket.client_contact || 'No especificado'}<br>
                                
                                <div style="margin-top: 15px;"><strong>📍 Dirección de entrega:</strong></div>
                                <div class="linea-puntos"></div>
                                
                                <div style="margin-top: 15px;"><strong>🏙️ Localidad / CP:</strong></div>
                                <div class="linea-puntos"></div>
                                
                                <div style="margin-top: 15px;"><strong>🗺️ Provincia:</strong></div>
                                <div class="linea-puntos"></div>
                            </div>
                        </div>

                        <div class="seccion">
                            <div class="seccion-titulo" style="background: #555;">Remitente</div>
                            <div class="texto-remitente">
                                <strong>YVAGA Indumentaria</strong><br>
                                Corrientes, Provincia de Corrientes (CP: 3400)<br>
                            </div>
                        </div>

                        <div class="barcode-container">
                            <img class="barcode-img" src="https://barcodeapi.org/api/128/${ticket.ticket_number}" alt="Barcode">
                            <div class="ticket-num">PEDIDO #${ticket.ticket_number}</div>
                            
                            <div class="peso-bultos">
                                <span>BULTOS: 1</span>
                                <span>PESO: ______ KG</span>
                            </div>
                        </div>

                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    }

    // 3. Controla la lógica del nro de seguimiento
    gestionarEnvio(ticket: any) {
        // Regla 1: Si no pagó, bloqueamos todo.
        if (ticket.status === 'pending') {
            alert('⚠️ No podés enviar un paquete si el pedido figura como IMPAGO.');
            return;
        }

        // Regla 2: Si ya está terminado, avisamos.
        if (ticket.status === 'completed') {
            alert('✅ Este pedido ya fue marcado como ENTREGADO y finalizado.');
            return;
        }

        // Regla 3: Si pagó pero no le cargaste el seguimiento, abrimos tu modal de tracking.
        if (!ticket.tracking_number) {
            this.openTrackingModal(ticket);
        } else {
            // Regla 4: Si ya tiene el número de seguimiento cargado, te pregunta si queremos dar ok final.
            if (confirm(`Este pedido ya tiene cargado el seguimiento (${ticket.tracking_number}). ¿Marcar definitivamente como ENTREGADO?`)) {
                this.adminSvc.completeTicket(ticket.id).subscribe({
                    next: () => {
                        this.recordAdminActivity('complete_ticket', { ticket_number: ticket.ticket_number });
                        this.loadTickets(); // Recarga y transforma el camioncito en un tilde verde ✅
                    },
                    error: () => alert('Error al completar el pedido en la base de datos.')
                });
            }
        }
    }

    // ====== VARIABLES PARA GUÍA DE TALLES ======
    sizeGuides: SizeGuide[] = [];

    editingGuideId: number | null = null;

    newGuide: SizeGuide = {
        category: '',
        size: 'M',
        min_weight: 0,
        max_weight: 0,
        min_height: 0,
        max_height: 0,
        chest_cm: 0,
        waist_cm: 0,
        hip_cm: 0,
        length_cm: 0
    };

    // ====== FUNCIONES DE GUÍA DE TALLES ======
    loadSizeGuides() {
        this.sizeGuideSvc.getAllGuides().subscribe({
            next: (data) => this.sizeGuides = data,
            error: (err) => console.error("Error cargando guías:", err)
        });
    }

    // Reemplazamos createSizeGuide por saveSizeGuide (porque ahora hace las dos cosas)
    saveSizeGuide() {
       
        if (!this.newGuide.category || !this.newGuide.min_weight || !this.newGuide.max_height) {
            alert("Por favor completá los datos principales.");
            return;
        }

        
        if (this.editingGuideId) {
            
            // actualiza
            this.sizeGuideSvc.updateGuide(this.editingGuideId, this.newGuide).subscribe({
                next: () => {
                    alert("¡Regla actualizada con éxito!");
                    this.loadSizeGuides(); // Recargamos la tabla
                    this.cancelEdit();     // Salimos del modo edición y limpiamos todo
                },
                error: (err) => alert("Error al actualizar.")
            });

        } else {
            
            // creamos
            this.sizeGuideSvc.createGuide(this.newGuide).subscribe({
                next: () => {
                    alert("¡Guía guardada con éxito!");
                    this.loadSizeGuides();
                    
                    // Limpiamos los números pero dejamos la categoría (tu lógica original)
                    this.newGuide.min_weight = 0;
                    this.newGuide.max_weight = 0;
                    this.newGuide.min_height = 0;
                    this.newGuide.max_height = 0;
                    // También reseteamos los centímetros nuevos
                    this.newGuide.chest_cm = 0;
                    this.newGuide.waist_cm = 0;
                    this.newGuide.hip_cm = 0;
                    this.newGuide.length_cm = 0;
                },
                error: (err) => alert("Error al guardar.")
            });
            
        }
    }

    deleteSizeGuide(id: number) {
        if (confirm("¿Estás seguro de borrar esta regla?")) {
            this.sizeGuideSvc.deleteGuide(id).subscribe({
                next: () => this.loadSizeGuides(),
                error: (err) => alert("Error al borrar.")
            });
        }
    }

    // Llena el formulario con los datos de la regla seleccionada
    editGuide(guide: SizeGuide) {
        this.editingGuideId = guide.id!;
        this.newGuide = { ...guide }; // Copia los datos exactos al formulario
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Sube la pantalla al formulario
    }

    // Cancela la edición y limpia el formulario
    cancelEdit() {
        this.editingGuideId = null;
        this.newGuide = {
            category: '', size: 'M', min_weight: 0, max_weight: 0,
            min_height: 0, max_height: 0, chest_cm: 0, waist_cm: 0, hip_cm: 0, length_cm: 0
        };
    }
}