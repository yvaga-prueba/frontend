import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, Seller } from '../../../services/seller.service';

@Component({
  selector: 'app-sellers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sellers.component.html',
  styleUrls: ['./sellers.component.css']
})
export class SellersComponent implements OnInit {
  private sellerService = inject(SellerService);
  
  sellers = signal<Seller[]>([]);
  showForm = signal(false);

  // Variables del formulario
  currentId = signal<number | null>(null);
  firstName = signal('');
  lastName = signal('');
  email = signal('');
  phone = signal('');
  couponCode = signal('');
  discountPercentage = signal(0.05); // 5% por defecto
  isActive = signal(true);

  ngOnInit() {
    this.loadSellers();
  }

  loadSellers() {
    this.sellerService.getSellers().subscribe({
      next: (data) => this.sellers.set(data),
      error: (err) => console.error('Error al cargar vendedores', err)
    });
  }

  openCreate() {
    this.resetForm();
    this.showForm.set(true);
  }

  openEdit(s: Seller) {
    this.currentId.set(s.id);
    this.firstName.set(s.first_name);
    this.lastName.set(s.last_name);
    this.email.set(s.email);
    this.phone.set(s.phone);
    this.couponCode.set(s.coupon_code);
    this.discountPercentage.set(s.discount_percentage);
    this.isActive.set(s.is_active);
    this.showForm.set(true);
  }

  save() {
    const payload = {
      first_name: this.firstName(),
      last_name: this.lastName(),
      email: this.email(),
      phone: this.phone(),
      coupon_code: this.couponCode(),
      discount_percentage: Number(this.discountPercentage()),
      is_active: this.isActive()
    };

    if (this.currentId()) {
      // Editar existente
      this.sellerService.updateSeller(this.currentId()!, payload).subscribe(() => {
        this.loadSellers();
        this.showForm.set(false);
      });
    } else {
      // Crear nuevo
      this.sellerService.createSeller(payload).subscribe(() => {
        this.loadSellers();
        this.showForm.set(false);
      });
    }
  }

  resetForm() {
    this.currentId.set(null);
    this.firstName.set('');
    this.lastName.set('');
    this.email.set('');
    this.phone.set('');
    this.couponCode.set('');
    this.discountPercentage.set(0.05);
    this.isActive.set(true);
  }
}