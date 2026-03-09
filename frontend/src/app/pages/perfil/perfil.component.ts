import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { TicketService, TicketSummary, Ticket } from '../../services/ticket.service';
import { ShippingService, ShippingTracking } from '../../services/shipping.service';

@Component({
    standalone: true,
    selector: 'app-perfil',
    imports: [CommonModule, RouterLink],
    templateUrl: './perfil.component.html',
    styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
    user = signal<UserResponse | null>(null);
    tickets = signal<TicketSummary[]>([]);
    ticketsLoading = signal(true);
    ticketsError = signal('');
    activeTab = signal<'compras' | 'deseados'>('compras');

    selectedTicket = signal<Ticket | null>(null);
    ticketLoading = signal(false);
    shippingTracking = signal<ShippingTracking | null>(null);

    /** Fomato localizado de moneda */
    formatPrice = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

    /** Etiqueta de estado */
    statusLabel: Record<string, string> = {
        pending: 'Pendiente',
        paid: 'Pagado',
        completed: 'Completado',
        cancelled: 'Cancelado',
    };

    statusClass: Record<string, string> = {
        pending: 'badge--pending',
        paid: 'badge--paid',
        completed: 'badge--completed',
        cancelled: 'badge--cancelled',
    };

    constructor(
        private authService: AuthService,
        private ticketService: TicketService,
        private shippingSvc: ShippingService,
        private router: Router
    ) { }

    ngOnInit() {
        this.user.set(this.authService.currentUser());
        this.loadTickets();
    }

    loadTickets() {
        this.ticketsLoading.set(true);
        this.ticketsError.set('');
        this.ticketService.getMyTickets().subscribe({
            next: (tickets) => {
                this.tickets.set(Array.isArray(tickets) ? tickets : (tickets as any).tickets ?? []);
                this.ticketsLoading.set(false);
            },
            error: () => {
                this.ticketsError.set('No se pudieron cargar las compras.');
                this.ticketsLoading.set(false);
            }
        });
    }

    setTab(tab: 'compras' | 'deseados') {
        this.activeTab.set(tab);
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/']);
    }

    openTicket(t: TicketSummary) {
        this.selectedTicket.set({ ...t, lines: [] } as any); // placeholder
        this.ticketLoading.set(true);
        this.shippingTracking.set(null);

        this.ticketService.getTicketById(t.id).subscribe({
            next: (ticket) => {
                this.selectedTicket.set(ticket);
                if (ticket.tracking_number) {
                    this.shippingSvc.getTrackingInfo(ticket.tracking_number).subscribe({
                        next: (res) => this.shippingTracking.set(res),
                        error: () => { }
                    });
                }
                this.ticketLoading.set(false);
            },
            error: () => {
                this.ticketLoading.set(false);
            }
        });
    }

    closeTicket() {
        this.selectedTicket.set(null);
        this.shippingTracking.set(null);
    }
}