import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, UserResponse } from '../../services/auth.service';
import { TicketService, TicketSummary, Ticket } from '../../services/ticket.service';
import { ShippingService, ShippingTracking } from '../../services/shipping.service';
import { FavoriteService } from '../../services/favorite.service';

@Component({
    standalone: true,
    selector: 'app-perfil',
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './perfil.component.html',
    styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
    user = signal<UserResponse | null>(null);
    tickets = signal<TicketSummary[]>([]);
    ticketsLoading = signal(true);
    ticketsError = signal('');
    activeTab = signal<'compras' | 'deseados'>('compras');

    favorites = computed(() => this.favoriteService.favorites());

    selectedTicket = signal<Ticket | null>(null);
    ticketLoading = signal(false);
    shippingTracking = signal<ShippingTracking | null>(null);

    // ==========================================
    // LÓGICA DE CAMBIO DE CONTRASEÑA
    // ==========================================
    showPasswordModal = signal(false);
    oldPassword = signal('');
    newPassword = signal('');
    confirmPassword = signal('');
    passwordError = signal('');
    passwordSuccess = signal('');
    isSubmitting = signal(false);

    
    formatPrice = (n: any) => {
        const numero = Number(n);
        // Si el backend no manda el precio o manda algo inválido, evitamos el "NaN"
        if (isNaN(numero) || n === null || n === undefined) {
            return '$ --'; 
        }
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(numero);
    };

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
        private favoriteService: FavoriteService,
        private router: Router
    ) { }

    ngOnInit() {
        this.user.set(this.authService.currentUser());
        this.loadTickets();
        this.favoriteService.loadFavorites();
    }



    removeFavorite(productId: number) {
        this.favoriteService.toggleFavorite(productId);
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

    // --- MÉTODOS DEL MODAL DE CONTRASEÑA ---
    closePasswordModal() {
        this.showPasswordModal.set(false);
        this.resetPasswordFields();
    }

    resetPasswordFields() {
        this.oldPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.passwordError.set('');
        this.passwordSuccess.set('');
        this.isSubmitting.set(false);
    }

    submitPasswordChange() {
        this.passwordError.set('');
        this.passwordSuccess.set('');

        if (!this.oldPassword() || !this.newPassword() || !this.confirmPassword()) {
            this.passwordError.set('Por favor, completá todos los campos.');
            return;
        }

        if (this.newPassword().length < 6) {
            this.passwordError.set('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (this.newPassword() !== this.confirmPassword()) {
            this.passwordError.set('Las contraseñas nuevas no coinciden.');
            return;
        }

        if (this.oldPassword() === this.newPassword()) {
            this.passwordError.set('La nueva contraseña debe ser diferente a la actual.');
            return;
        }

        this.isSubmitting.set(true);

        this.authService.changePassword(this.oldPassword(), this.newPassword()).subscribe({
            next: (respuesta: any) => {
                this.isSubmitting.set(false);
                this.passwordSuccess.set('¡Contraseña actualizada con éxito!');
                setTimeout(() => {
                    this.closePasswordModal();
                }, 1500);
            },
            error: (error: any) => {
                this.isSubmitting.set(false);
                const mensajeError = error.error?.message || 'Error al cambiar la contraseña. Intentá nuevamente.';
                this.passwordError.set(mensajeError);
            }
        });
    }

    // --- MÉTODOS DE TICKETS ---
    openTicket(t: TicketSummary) {
        this.selectedTicket.set({ ...t, lines: [] } as any);
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