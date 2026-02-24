import {
    Component, OnInit, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
    AdminService, AdminProduct, CreateProductPayload
} from '../../services/admin.service';
import { TicketSummary } from '../../services/ticket.service';

type AdminSection = 'dashboard' | 'ventas' | 'productos' | 'actividad';

@Component({
    standalone: true,
    selector: 'app-admin',
    imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit {

    /* ── Navigation ── */
    activeSection = signal<AdminSection>('dashboard');
    sidebarOpen = signal(true);

    /* ── User ── */
    user = computed(() => this.auth.currentUser());

    /* ── Tickets ── */
    tickets = signal<TicketSummary[]>([]);
    ticketsLoading = signal(false);
    ticketsError = signal('');
    ticketFilter = signal('');

    /* ── Products ── */
    products = signal<AdminProduct[]>([]);
    productsLoading = signal(false);
    productsError = signal('');

    /* ── Modal crear/editar producto ── */
    showProductModal = signal(false);
    editingProduct = signal<AdminProduct | null>(null);
    productForm = signal<Partial<CreateProductPayload>>({});
    productSaving = signal(false);
    productFormError = signal('');

    /* ── Confirm delete ── */
    deletingProductId = signal<number | null>(null);

    /* ── Add stock modal ── */
    stockModalProduct = signal<AdminProduct | null>(null);
    stockAmount = signal(1);
    stockSaving = signal(false);
    stockError = signal('');

    /* ── KPIs ── */
    kpis = computed(() => {
        const t = this.tickets();
        const total = t.reduce((s, tk) => s + tk.total, 0);
        const paid = t.filter(tk => tk.status === 'paid').length;
        const completed = t.filter(tk => tk.status === 'completed').length;
        const cancelled = t.filter(tk => tk.status === 'cancelled').length;
        return { count: t.length, total, paid, completed, cancelled };
    });

    filteredTickets = computed(() => {
        const f = this.ticketFilter();
        if (!f) return this.tickets();
        return this.tickets().filter(t =>
            t.ticket_number.toLowerCase().includes(f.toLowerCase()) ||
            t.status.toLowerCase().includes(f.toLowerCase())
        );
    });

    stockAlert = computed(() =>
        this.products().filter(p => p.stock <= 5)
    );

    /* ── Helpers ── */
    readonly statusLabel: Record<string, string> = {
        pending: 'Pendiente', paid: 'Pagado',
        completed: 'Completado', cancelled: 'Cancelado'
    };
    readonly statusClass: Record<string, string> = {
        pending: 'badge--pending', paid: 'badge--paid',
        completed: 'badge--completed', cancelled: 'badge--cancelled'
    };
    readonly SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

    formatCurrency = (n: number) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency', currency: 'ARS', maximumFractionDigits: 0
        }).format(n);

    constructor(
        private auth: AuthService,
        private adminSvc: AdminService,
        private router: Router
    ) { }

    ngOnInit() {
        this.loadTickets();
        this.loadProducts();
    }

    setSection(s: AdminSection) { this.activeSection.set(s); }

    /* ── Tickets ── */
    loadTickets() {
        this.ticketsLoading.set(true);
        this.ticketsError.set('');
        this.adminSvc.getAllTickets({ limit: 100 }).subscribe({
            next: res => {
                // backend devuelve el array directamente
                const arr = Array.isArray(res) ? res : (res as any).tickets ?? [];
                this.tickets.set(arr);
                this.ticketsLoading.set(false);
            },
            error: () => {
                this.ticketsError.set('No se pudieron cargar las ventas.');
                this.ticketsLoading.set(false);
            }
        });
    }

    completeTicket(id: number) {
        this.adminSvc.completeTicket(id).subscribe({ next: () => this.loadTickets() });
    }

    cancelTicket(id: number) {
        if (!confirm('¿Cancelar este ticket? Se restaurará el stock.')) return;
        this.adminSvc.cancelTicket(id).subscribe({ next: () => this.loadTickets() });
    }

    /* ── Products ── */
    loadProducts() {
        this.productsLoading.set(true);
        this.productsError.set('');
        this.adminSvc.getProducts().subscribe({
            next: res => {
                this.products.set(res.products ?? []);
                this.productsLoading.set(false);
            },
            error: () => {
                this.productsError.set('No se pudieron cargar los productos.');
                this.productsLoading.set(false);
            }
        });
    }

    openCreateProduct() {
        this.editingProduct.set(null);
        this.productForm.set({ size: 'M', stock: 0, unit_price: 0, bar_code: 0 });
        this.productFormError.set('');
        this.showProductModal.set(true);
    }

    openEditProduct(p: AdminProduct) {
        this.editingProduct.set(p);
        this.productForm.set({
            bar_code: p.bar_code, title: p.title, description: p.description,
            stock: p.stock, size: p.size, category: p.category, unit_price: p.unit_price
        });
        this.productFormError.set('');
        this.showProductModal.set(true);
    }

    saveProduct() {
        const form = this.productForm();
        if (!form.title || !form.category) {
            this.productFormError.set('Título y categoría son obligatorios.');
            return;
        }
        this.productSaving.set(true);
        const editing = this.editingProduct();
        const obs = editing
            ? this.adminSvc.updateProduct(editing.id, form)
            : this.adminSvc.createProduct(form as CreateProductPayload);

        obs.subscribe({
            next: () => {
                this.showProductModal.set(false);
                this.productSaving.set(false);
                this.loadProducts();
            },
            error: (err) => {
                this.productFormError.set(err?.error?.error ?? 'Error al guardar.');
                this.productSaving.set(false);
            }
        });
    }

    confirmDeleteProduct(id: number) { this.deletingProductId.set(id); }
    cancelDelete() { this.deletingProductId.set(null); }
    deleteProduct(id: number) {
        this.adminSvc.deleteProduct(id).subscribe({
            next: () => { this.deletingProductId.set(null); this.loadProducts(); },
            error: () => this.deletingProductId.set(null)
        });
    }

    /* ── Add stock ── */
    openAddStock(p: AdminProduct) {
        this.stockModalProduct.set(p);
        this.stockAmount.set(1);
        this.stockError.set('');
    }

    closeStockModal() {
        this.stockModalProduct.set(null);
        this.stockError.set('');
    }

    saveStock() {
        const p = this.stockModalProduct();
        if (!p) return;
        const qty = this.stockAmount();
        if (qty <= 0) { this.stockError.set('La cantidad debe ser mayor a 0.'); return; }
        this.stockSaving.set(true);
        this.stockError.set('');
        this.adminSvc.addStock(p.id, qty).subscribe({
            next: () => {
                this.stockSaving.set(false);
                this.closeStockModal();
                this.loadProducts();
            },
            error: (err) => {
                this.stockError.set(err?.error?.error ?? 'Error al actualizar el stock.');
                this.stockSaving.set(false);
            }
        });
    }

    updateFormField(field: string, value: unknown) {
        this.productForm.update(f => ({ ...f, [field]: value }));
    }

    logout() {
        this.auth.logout();
        this.router.navigate(['/']);
    }
}
