import {
    Component, OnInit, signal, computed, ChangeDetectionStrategy,
    inject, PLATFORM_ID, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminService, CreateProductPayload, BackendTicketSummary } from '../../services/admin.service';
import { TicketService } from '../../services/ticket.service';
import { DashboardStats } from '../../models/admin.model';
import { Product } from '../../models/product.model';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

type AdminSection = 'dashboard' | 'pedidos' | 'ventas' | 'detalle-ventas' | 'productos' | 'actividad' | 'analiticas';

interface ActivityEvent {
    type: 'sale' | 'afip' | 'cancel' | 'stock' | 'product';
    typeLabel: string;
    icon: string;
    title: string;
    subtitle: string;
    time: Date;
}

// Ticket tal como lo maneja la tabla interna del admin
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
}

@Component({
    standalone: true,
    selector: 'app-admin',
    imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit {
    private auth = inject(AuthService);
    private adminSvc = inject(AdminService);
    private ticketSvc = inject(TicketService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    /* ── Navigation ── */
    activeSection = signal<AdminSection>('dashboard');
    mobileMenuOpen = signal(false);

    /* ── User ── */
    user = computed(() => this.auth.currentUser());

    /* ── Estadísticas / Filtros ── */
    statsPeriod = signal<string>('month');
    customStartDate = signal<string>('');
    customEndDate = signal<string>('');
    public salesChart: any;

    /* ── Datos ── */
    tickets = signal<ExtendedTicket[]>([]);
    rawSales = signal<BackendTicketSummary[]>([]);  // datos crudos del backend
    products = signal<Product[]>([]);
    activities = signal<any[]>([]);

    bestCustomers = signal<{ name: string; total: number }[]>([]);
    bestProducts = signal<{ name: string; sales: number }[]>([]);
    bestSellers = signal<{ name: string; total: number }[]>([]);

    advancedStats = signal({ maxTicket: 0, minTicket: 0, modeTicket: 0, upt: 0, peakTime: '', discountRate: 0, topCombo: '' });

    /* ── UI States ── */
    ticketsLoading = signal(false);
    ticketsError = signal('');
    productsLoading = signal(false);
    productsError = signal('');

    ticketFilter = signal('');
    productFilter = signal('');

    // Modal de detalle de ticket
    selectedSaleTicket = signal<any | null>(null);
    modalLoading = signal(false);

    // Modal de datos AFIP (para copiar campos y verificar)
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

    /* ── Carga de tickets desde backend ── */
    loadTickets() {
        this.ticketsLoading.set(true);
        this.ticketsError.set('');

        this.adminSvc.getAllSales().subscribe({
            next: (sales) => {
                // getAllSales() ya devuelve SaleDetail[], que internamente viene de BackendTicketSummary[]
                // Guardamos los summaries crudos también para calcular stats
                const extended: ExtendedTicket[] = sales.map((s: any) => ({
                    id: s.id,
                    ticket_number: s.ticket_number,
                    status: s.status,
                    payment_method: s.paymentMethod,
                    total: s.total,
                    item_count: 0,
                    created_at: s.date instanceof Date ? s.date.toISOString() : s.date,
                    invoice_type: s.invoice_type ?? null,
                    invoice_number: s.invoice_number ?? null,
                    cae: s.cae ?? null,
                    cae_due_date: s.cae_due_date ?? null,
                }));
                this.tickets.set(extended);
                this.calculateStats(sales as any);
                this.ticketsLoading.set(false);
                this.cdr.markForCheck();
            },
            error: (err) => {
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

        const maxTicket = validSales.reduce((m: number, s: any) => s.total > m ? s.total : m, 0);
        this.advancedStats.set({ maxTicket, minTicket: 0, modeTicket: 0, upt: 0, peakTime: '', discountRate: 0, topCombo: '' });

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
        this.selectedSaleTicket.set({ id: ticketId, ticket_number: '...', items: [], total: 0 }); // placeholder
        this.cdr.markForCheck();

        this.ticketSvc.getTicketById(ticketId).subscribe({
            next: (ticket) => {
                // Enriquecemos con los datos del ticket de la tabla
                const base = this.tickets().find(t => t.id === ticketId);
                this.selectedSaleTicket.set({
                    ...ticket,
                    payment_method: ticket.payment_method,
                    invoice_type: ticket.invoice_type ?? base?.invoice_type,
                    invoice_number: ticket.invoice_number ?? base?.invoice_number,
                    cae: ticket.cae ?? base?.cae,
                    cae_due_date: ticket.cae_due_date ?? base?.cae_due_date,
                    items: (ticket.lines ?? []).map((l: any) => ({
                        name: l.product_title,
                        quantity: l.quantity,
                        price: l.unit_price,
                        subtotal: l.subtotal
                    }))
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

    closeSaleTicket() { this.selectedSaleTicket.set(null); }

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

    getWhatsappLink(): string {
        const sale = this.selectedSaleTicket();
        if (!sale) return '';
        return `https://wa.me/5493412557667?text=${encodeURIComponent(`¡Hola! Te escribimos de YVAGA 🖤 respecto a tu orden #${sale.ticket_number}.`)}`;
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
            next: () => { this.deletingProductId.set(null); this.loadProducts(); },
            error: (err) => { alert('Error al eliminar: ' + (err?.error?.message ?? 'Error desconocido')); }
        });
    }

    updateFormField(field: string, value: any) {
        this.productForm.update(f => ({ ...f, [field]: value }));
    }

    logout() { this.auth.logout(); this.router.navigate(['/']); }
}