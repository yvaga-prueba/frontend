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

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

type AdminSection = 'dashboard' | 'pedidos' | 'ventas' | 'detalle-ventas' | 'productos' | 'actividad' | 'analiticas';

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
    lines?: any[]; // Importante para que funcione ticket.lines?.length
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

    advancedStats = signal({ maxTicket: 0, maxTicketClient: '', maxTicketSeller: '', maxTicketLines: [] as any[], minTicket: 0, modeTicket: 0, upt: 0, peakTime: '', discountRate: 0, topCombo: '' });

    /* ── UI States ── */
    ticketsLoading = signal(false);
    ticketsError = signal('');
    productsLoading = signal(false);
    productsError = signal('');

    ticketFilter = signal('');
    productFilter = signal('');

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
        const f = this.ticketFilter().toLowerCase();
        if (!f) return this.tickets();
        if (f === 'pagadas') return this.tickets().filter(t => t.status === 'paid' || t.status === 'completed');
        return this.tickets().filter(t =>
            t.ticket_number.toLowerCase().includes(f) ||
            t.status.toLowerCase().includes(f) ||
            (t.payment_method && t.payment_method.toLowerCase().includes(f))
        );
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
        const f = this.productFilter().toLowerCase();
        if (!f) return this.products();
        return this.products().filter(p =>
            p.title.toLowerCase().includes(f) || (p.category && p.category.toLowerCase().includes(f))
        );
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
        this.loadGoalFromDB(); // <--- AGREGAMOS ESTA LÍNEA PARA LLAMAR A LA BASE DE DATOS
        
        this.activities.set([
            { id: 1, text: 'Panel de control iniciado', time: 'Ahora', color: 'green' }
        ]);
    }

    setSection(s: AdminSection) {
        this.activeSection.set(s);
        this.ticketFilter.set('');
        this.mobileMenuOpen.set(false);
        if (s === 'dashboard') setTimeout(() => this.updateChart(), 200);
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
                    price: p.unit_price ?? 0
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
            setTimeout(() => this.updateChart(), 200);
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

        setTimeout(() => this.updateChart(), 200);
        this.cdr.markForCheck();
    }

    /* ── Gráfico ── */
    updateChart(isMock: boolean = false) {
        if (!isPlatformBrowser(this.platformId)) return;
        const canvas = document.getElementById('salesChart') as HTMLCanvasElement;
        if (!canvas) return;
        if (this.salesChart) this.salesChart.destroy();
        const data = isMock
            ? [12000, 19000, 15000, 25000, 22000, 30000, 28000]
            : [this.stats().totalSales];
        this.salesChart = new Chart(canvas, {
            type: 'line',
            data: { labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], datasets: [{ label: 'Ingresos', data, borderColor: '#e7070e', backgroundColor: 'rgba(231, 7, 14, 0.1)', fill: true, tension: 0.4 }] },
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
                    client_contact: ticket.client_contact || base?.client_contact || 'Consumidor Final',
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
        this.productForm.set({ size: 'M', stock: 0, unit_price: 0, bar_code: 0 });
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
}