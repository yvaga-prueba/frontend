import {
    Component, OnInit, signal, computed, ChangeDetectionStrategy, inject, PLATFORM_ID
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
    AdminService, CreateProductPayload
} from '../../services/admin.service';
import { TicketSummary } from '../../services/ticket.service';
import { DashboardStats, SaleDetail } from '../../models/admin.model';
import { Product } from '../../models/product.model';

// Importamos Chart.js para el gráfico de ingresos del Dashboard
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// Definimos las secciones posibles del panel para controlar la navegación
type AdminSection = 'dashboard' | 'pedidos' | 'detalle-ventas' | 'productos' | 'actividad' | 'analiticas';

// Interfaz extendida para manejar los datos extra en la tabla sin romper el modelo original
// Acá sumamos cosas como el tipo de cliente, vendedor, descuento y dirección.
interface ExtendedTicket {
    id: number;
    ticket_number: string;
    status: string;
    payment_method: string;
    total: number;
    item_count: number;
    created_at: string;
    customer_name: string;
    customer_type: 'invitado' | 'registrado' | 'nuevo'; 
    seller_name: string | null;
    coupon_used: string | null;
    discount_percentage: number;
    items_summary: string;
    customer_address: string; 
}

@Component({
    standalone: true,
    selector: 'app-admin',
    imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.css'],
    // Optimizamos el rendimiento de la vista
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit {
    // Inyección de dependencias (Servicios, Router, etc.)
    private auth = inject(AuthService);
    private adminSvc = inject(AdminService);
    private router = inject(Router);
    private platformId = inject(PLATFORM_ID);

    /* ── Navigation ── */
    // Controla qué pantalla está viendo el usuario (arranca en Dashboard)
    activeSection = signal<AdminSection>('dashboard');
    // Controla si el menú de celular está abierto o cerrado
    mobileMenuOpen = signal(false);

    /* ── User ── */
    // Obtenemos los datos del usuario logueado (Super Admin, etc.)
    user = computed(() => this.auth.currentUser());

    /* ── Filtros y Estadísticas ── */
    // Controles para el selector de fechas superior
    statsPeriod = signal<string>('month');
    customStartDate = signal<string>('');
    customEndDate = signal<string>('');
    public salesChart: any;

    /* ── Datos Principales ── */
    // Almacenamos la info que traemos de la base de datos o de nuestros mocks
    tickets = signal<ExtendedTicket[]>([]);
    allSalesDetails = signal<SaleDetail[]>([]);
    products = signal<Product[]>([]);
    activities = signal<any[]>([]); 

    // Rankings para las tarjetas inferiores del Dashboard
    bestCustomers = signal<{name: string, total: number}[]>([]);
    bestProducts = signal<{name: string, sales: number}[]>([]);
    bestSellers = signal<{name: string, total: number}[]>([]);
    
    // Estadísticas detalladas para la vista de "Analíticas de Ticket"
    advancedStats = signal({
        maxTicket: 0, minTicket: 0, modeTicket: 0, upt: 0, peakTime: '', discountRate: 0, topCombo: ''
    });
    
    /* ── UI States y Filtros ── */
    // Controladores de estado (carga, errores, buscadores)
    ticketsLoading = signal(false);
    ticketsError = signal('');
    productsLoading = signal(false);
    productsError = signal('');
    
    ticketFilter = signal('');
    productFilter = signal('');

    // Controla qué ticket estamos viendo en el Pop-Up
    selectedSaleTicket = signal<any | null>(null);

    // Objeto principal que alimenta los números grandes del Dashboard
    stats = signal<DashboardStats>({ 
        totalSales: 0, totalOrders: 0, averageTicket: 0, salesGrowth: 0, ticketGrowth: 0,
        paymentMethods: { efectivo: 0, transferencia: 0, tarjeta: 0 },
        discounts: { totalAmount: 0, impactPercent: 0 },
        categoryStats: [] 
    });

    /* ── Modales ── */
    // Controladores para la vista de edición/creación de productos
    showProductModal = signal(false);
    editingProduct = signal<Product | null>(null);
    productForm = signal<Partial<CreateProductPayload>>({});
    productSaving = signal(false);
    productFormError = signal('');
    deletingProductId = signal<number | null>(null);

    /* ── KPIs Computados y Búsquedas ── */
    // Calcula los numeritos rojos (badges) que aparecen en el menú lateral
    kpis = computed(() => {
        const t = this.tickets();
        const total = t.reduce((s, tk) => s + tk.total, 0);
        const paid = t.filter(tk => tk.status === 'paid' || tk.status === 'completed').length;
        const completed = t.filter(tk => tk.status === 'completed').length;
        const cancelled = t.filter(tk => tk.status === 'cancelled').length;
        return { count: t.length, total, paid, completed, cancelled };
    });

    // Filtra la tabla principal de "Pedidos" en base a lo que escribimos en el buscador
    filteredTickets = computed(() => {
        const f = this.ticketFilter().toLowerCase();
        if (!f) return this.tickets();
        
        // Atajo: si buscamos "pagadas", trae las paid o completed
        if (f === 'pagadas') return this.tickets().filter(t => t.status === 'paid' || t.status === 'completed');

        return this.tickets().filter(t =>
            t.ticket_number.toLowerCase().includes(f) ||
            t.status.toLowerCase().includes(f) ||
            (t.payment_method && t.payment_method.toLowerCase().includes(f)) ||
            (t.customer_name && t.customer_name.toLowerCase().includes(f)) ||
            (t.seller_name && t.seller_name.toLowerCase().includes(f))
        );
    });

    // Filtro estricto para "Detalle de Ventas": solo muestra cobradas y aplica la búsqueda
    detalleVentasTickets = computed(() => {
        const f = this.ticketFilter().toLowerCase();
        const cobradas = this.tickets().filter(t => t.status === 'paid' || t.status === 'completed');
        if (!f) return cobradas;
        
        return cobradas.filter(t => 
            t.ticket_number.toLowerCase().includes(f) || 
            (t.payment_method && t.payment_method.toLowerCase().includes(f)) ||
            (t.customer_name && t.customer_name.toLowerCase().includes(f)) ||
            (t.seller_name && t.seller_name.toLowerCase().includes(f))
        );
    });

    // Filtra el catálogo de productos
    filteredProducts = computed(() => {
        const f = this.productFilter().toLowerCase();
        if (!f) return this.products();
        return this.products().filter(p => 
            p.title.toLowerCase().includes(f) || (p.category && p.category.toLowerCase().includes(f))
        );
    });

    // Detecta qué productos tienen bajo stock (<= 5) para mostrar alerta
    stockAlert = computed(() => this.products().filter(p => p.stock <= 5));

    // Helpers visuales para traducir los estados del backend a español y darles color
    readonly statusLabel: Record<string, string> = {
        pending: 'Pendiente', paid: 'Pagado', completed: 'Completado', cancelled: 'Cancelado'
    };
    readonly statusClass: Record<string, string> = {
        pending: 'badge--pending', paid: 'badge--paid', completed: 'badge--completed', cancelled: 'badge--cancelled'
    };
    readonly SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

    ngOnInit() { 
        this.loadInitialData(); 
    }

    // Función que arranca todo al cargar la página
    loadInitialData() {
        this.loadProducts();
        this.loadTickets();
        
        // Mock temporal de la pestaña actividad
        this.activities.set([
            { id: 1, text: 'Facundo completó el ticket YVG-0001', time: 'Hace 5 min', color: 'green' },
            { id: 2, text: 'Nuevo usuario registrado: Juan Pérez', time: 'Hace 1 hora', color: 'blue' }
        ]);
    }

    // Cambia entre las distintas pantallas (Dashboard, Pedidos, etc.)
    setSection(s: AdminSection) { 
        this.activeSection.set(s); 
        this.ticketFilter.set(''); 
        this.mobileMenuOpen.set(false); // Cierra el menú en celulares al tocar un botón
        // Si vamos al dashboard, le damos un respiro al DOM antes de dibujar el gráfico
        if (s === 'dashboard') setTimeout(() => this.updateChart(), 200);
    }

    // Atajos rápidos: navegan a una sección y autocompletan el buscador
    goToSales(term: string) {
        this.ticketFilter.set(term);
        this.activeSection.set('pedidos');
    }

    goToProducts(term: string) {
        this.productFilter.set(term);
        this.activeSection.set('productos');
    }

    //  LÓGICA DE DESCUENTOS 

    
    // Calcula el porcentaje de descuento sumando beneficios según las reglas de YVAGA
    calcularDescuento(tipoCliente: string, cupon: string | null): number {
        let descuento = 0;
        // Si es su primera compra (nuevo), tiene 3%
        if (tipoCliente === 'nuevo') descuento += 3;
        // Si usó el código de un vendedor, le sumo 5%
        if (cupon) descuento += 5;
        // El máximo acumulable será 8%
        return descuento;
    }

    
    //  CONEXIÓN CON LA BASE DE DATOS 
   
    
    // Pide todas las ventas al back y las prepara para mostrarlas
    loadTickets() {
        this.ticketsLoading.set(true);
        
        this.adminSvc.getAllSales().subscribe({
            next: (res: SaleDetail[]) => {
                this.allSalesDetails.set(res);
                this.tickets.set(res.map(s => {
                    // Mapeo seguro de datos extra para no romper si el back no los manda
                    const customerType = (s as any).customerType || 'registrado';
                    const couponUsed = (s as any).couponUsed || null;

                    return {
                        id: s.id,
                        ticket_number: s.ticket_number,
                        status: s.status as any,
                        payment_method: s.paymentMethod as any,
                        total: s.total,
                        item_count: s.items.length,
                        created_at: s.date.toISOString(),
                        
                        // Campos extra mapeados para nuestra tabla enriquecida
                        customer_name: (s as any).customerName || 'Cliente Web',
                        customer_type: customerType,
                        seller_name: (s as any).sellerName || null,
                        coupon_used: couponUsed,
                        discount_percentage: this.calcularDescuento(customerType, couponUsed),
                        items_summary: s.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
                        customer_address: (s as any).customerAddress || 'Retiro en local'
                    };
                }));
                this.calculateStats(); 
                this.ticketsLoading.set(false);
            },
            // Si el back está caído, inyectamos data de prueba para poder seguir maquetando
            error: () => { this.inyectarMockDataCompleto(); }
        });
    }

    // Pide el catálogo de productos al back
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
            },
            error: () => {
                this.products.set([
                    { id: 1, title: 'Buzo YVAGA Black', description: 'Buzo oversize friza', price: 45000, stock: 12, size: 'L', category: 'Buzos', bar_code: 1001, unit_price: 45000 },
                    { id: 2, title: 'Remera Oversize Red', description: 'Algodón 100%', price: 18500, stock: 3, size: 'M', category: 'Remeras', bar_code: 1002, unit_price: 18500 }
                ]);
                this.productsLoading.set(false);
            }
        });
    }

    //  DATA FAKE PARA MAQUETAR 
    

    // Genera datos de prueba realistas para probar todas las vistas y casos (cupones, etc)
    inyectarMockDataCompleto() {
        this.tickets.set([
            { id: 1, ticket_number: 'YVG-0001', status: 'completed', payment_method: 'transferencia', total: 63500, item_count: 2, created_at: new Date().toISOString(), customer_name: 'Juan Pérez', customer_address: 'San Martín 1234, Corrientes', customer_type: 'nuevo', seller_name: 'Facu', coupon_used: 'FACU10', discount_percentage: this.calcularDescuento('nuevo', 'FACU10'), items_summary: 'Buzo Black (x1), Remera Red (x1)' },
            { id: 2, ticket_number: 'YVG-0002', status: 'paid', payment_method: 'tarjeta', total: 45000, item_count: 1, created_at: new Date(Date.now() - 86400000).toISOString(), customer_name: 'María García', customer_address: 'Retiro en Local', customer_type: 'registrado', seller_name: 'Facu', coupon_used: 'FACU10', discount_percentage: this.calcularDescuento('registrado', 'FACU10'), items_summary: 'Buzo Black (x1)' },
            { id: 3, ticket_number: 'YVG-0003', status: 'pending', payment_method: 'efectivo', total: 18500, item_count: 1, created_at: new Date(Date.now() - 172800000).toISOString(), customer_name: 'Carlos Diaz', customer_address: 'Av. Belgrano 456, Rosario', customer_type: 'nuevo', seller_name: null, coupon_used: null, discount_percentage: this.calcularDescuento('nuevo', null), items_summary: 'Remera Red (x1)' },
            { id: 4, ticket_number: 'YVG-0004', status: 'cancelled', payment_method: 'transferencia', total: 12000, item_count: 1, created_at: new Date(Date.now() - 259200000).toISOString(), customer_name: 'Cliente Invitado', customer_address: 'Retiro en Local', customer_type: 'invitado', seller_name: null, coupon_used: null, discount_percentage: this.calcularDescuento('invitado', null), items_summary: 'Gorra Logo (x1)' }
        ]);

        // Detalles con items para que el botón "Ver Ticket" no falle nunca
        this.allSalesDetails.set([
            { id: 1, ticket_number: 'YVG-0001', status: 'completed', paymentMethod: 'transferencia', total: 63500, items: [{name: 'Buzo YVAGA Black', quantity: 1, price: 45000}, {name: 'Remera Oversize Red', quantity: 1, price: 18500}], date: new Date() } as unknown as SaleDetail,
            { id: 2, ticket_number: 'YVG-0002', status: 'paid', paymentMethod: 'tarjeta', total: 45000, items: [{name: 'Buzo YVAGA Black', quantity: 1, price: 45000}], date: new Date() } as unknown as SaleDetail,
            { id: 3, ticket_number: 'YVG-0003', status: 'pending', paymentMethod: 'efectivo', total: 18500, items: [{name: 'Remera Oversize Red', quantity: 1, price: 18500}], date: new Date() } as unknown as SaleDetail,
            { id: 4, ticket_number: 'YVG-0004', status: 'cancelled', paymentMethod: 'transferencia', total: 12000, items: [{name: 'Gorra Logo Classic', quantity: 1, price: 12000}], date: new Date() } as unknown as SaleDetail,
        ]);

        // Inyectamos las stats de mentira para el Dashboard
        this.stats.set({
            totalSales: 850400, totalOrders: 42, averageTicket: 20247, salesGrowth: 12.5, ticketGrowth: 5.2,
            paymentMethods: { efectivo: 30, transferencia: 50, tarjeta: 20 }, discounts: { totalAmount: 45000, impactPercent: 5.3 },
            categoryStats: [{ label: 'Oversized Hoodies', percent: 45 }, { label: 'Remeras Básicas', percent: 35 }]
        });
        
        this.bestCustomers.set([{ name: 'Juan Pérez', total: 150000 }, { name: 'María García', total: 120000 }]);
        this.bestProducts.set([{ name: 'Buzo YVAGA Black', sales: 25 }, { name: 'Remera Oversize Red', sales: 18 }]);
        this.bestSellers.set([{ name: 'Venta Web', total: 650000 }, { name: 'Facundo (Admin)', total: 200400 }]);
        this.advancedStats.set({ maxTicket: 145000, minTicket: 8500, modeTicket: 18500, upt: 2.4, peakTime: 'Viernes 20:00', discountRate: 15, topCombo: 'Buzo Black + Gorra Logo' });

        setTimeout(() => this.updateChart(true), 200);
        this.ticketsLoading.set(false);
    }

    // Calcula todas las estadísticas (KPIs) en base a los datos reales
    calculateStats() {
        if (this.allSalesDetails().length === 0) return;
        const sales = this.adminSvc.filterSalesByPeriod(this.allSalesDetails(), this.statsPeriod(), this.customStartDate(), this.customEndDate());
        const validSales = sales.filter(s => s.status === 'paid' || s.status === 'completed');
        const totalSales = validSales.reduce((acc, s) => acc + s.total, 0);
        this.stats.set({ ...this.stats(), totalSales, totalOrders: validSales.length, averageTicket: validSales.length > 0 ? (totalSales / validSales.length) : 0 });
        setTimeout(() => this.updateChart(false), 200);
    }

    // Dibuja el gráfico de líneas del Dashboard
    updateChart(isMock: boolean = false) {
        if (!isPlatformBrowser(this.platformId)) return;
        const canvas = document.getElementById('salesChart') as HTMLCanvasElement;
        if (!canvas) return;
        if (this.salesChart) this.salesChart.destroy();
        this.salesChart = new Chart(canvas, {
            type: 'line',
            data: { labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'], datasets: [{ label: 'Ingresos', data: [12000, 19000, 15000, 25000, 22000, 30000, 28000], borderColor: '#e7070e', backgroundColor: 'rgba(231, 7, 14, 0.1)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    /* ── Acciones de Gestión de Tickets ── */
    completeTicket(id: number) { this.adminSvc.completeTicket(id).subscribe({ next: () => this.loadTickets() }); }
    cancelTicket(id: number) { if (confirm('¿Cancelar este ticket?')) { this.adminSvc.cancelTicket(id).subscribe({ next: () => this.loadTickets() }); } }

    // Abre el modal fusionando los datos del ticket general con sus items específicos
    openSaleTicket(ticketId: number) {
        const ticketBase = this.tickets().find(t => t.id === ticketId);
        const saleDetail = this.allSalesDetails().find(s => s.id === ticketId);
        
        if (ticketBase && saleDetail) {
            this.selectedSaleTicket.set({
                ...ticketBase,
                items: saleDetail.items
            });
        }
    }
    
    closeSaleTicket() { this.selectedSaleTicket.set(null); }
    
    // Genera el link directo a WhatsApp Web/App para contactar al cliente sobre una orden específica
    getWhatsappLink(): string {
        const sale = this.selectedSaleTicket();
        if (!sale) return '';
        return `https://wa.me/5493412557667?text=${encodeURIComponent(`¡Hola! Te escribimos de YVAGA 🖤 respecto a tu orden #${sale.ticket_number}.`)}`;
    }

    // Exporta la tabla filtrada de Detalle de Ventas a un archivo CSV compatible con Excel latino
    exportSalesToCSV() {
        const data = this.detalleVentasTickets().map(t => ({
            'N° Ticket': t.ticket_number,
            'Cliente': t.customer_name,
            'Tipo': t.customer_type,
            'Vendedor': t.seller_name || '-',
            'Cupón': t.coupon_used || '-',
            'Items': t.items_summary,
            'Medio de Pago': t.payment_method,
            'Descuento': `${t.discount_percentage}%`,
            'Total ($)': t.total,
            'Fecha': new Date(t.created_at).toLocaleDateString('es-AR')
        }));

        if (data.length === 0) { alert('No hay datos para exportar.'); return; }
        
        // Usamos punto y coma para separar columnas (formato Excel ES) y \uFEFF para respetar las eñes y tildes
        const headers = Object.keys(data[0]);
        const separator = ';'; 
        const csvRows = data.map(row => headers.map(fieldName => `"${(row as any)[fieldName]}"`).join(separator));
        const csvString = '\uFEFF' + [headers.join(separator), ...csvRows].join('\r\n');
        
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `YVAGA_Detalle_Ventas_${new Date().toLocaleDateString('es-AR')}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /* ── CRUD de Productos (Gestión de Catálogo) ── */
    openCreateProduct() { this.editingProduct.set(null); this.productForm.set({ size: 'M', stock: 0, unit_price: 0, bar_code: 0 }); this.showProductModal.set(true); }
    openEditProduct(p: Product) { this.editingProduct.set(p); this.productForm.set({ bar_code: p.bar_code, title: p.title, description: p.description, stock: p.stock, size: p.size, category: p.category, unit_price: p.unit_price ?? p.price }); this.showProductModal.set(true); }
    saveProduct() {} // TODO: Conectar lógica de guardado
    confirmDeleteProduct(id: number) { this.deletingProductId.set(id); }
    cancelDelete() { this.deletingProductId.set(null); }
    deleteProduct(id: number) { this.adminSvc.deleteProduct(id).subscribe({ next: () => { this.deletingProductId.set(null); this.loadProducts(); } }); }
    updateFormField(field: string, value: any) { this.productForm.update(f => ({ ...f, [field]: value })); }
    
    // Cierra sesión y manda al usuario a la página de inicio
    logout() { this.auth.logout(); this.router.navigate(['/']); }
}