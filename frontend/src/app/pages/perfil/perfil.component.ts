import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { TicketService, TicketSummary } from '../../services/ticket.service';

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
            next: (res) => {
                this.tickets.set(res.tickets ?? []);
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
}
