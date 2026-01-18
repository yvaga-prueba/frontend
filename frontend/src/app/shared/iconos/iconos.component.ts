import { Component, Inject, PLATFORM_ID, ElementRef, ViewChild } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';

@Component({
  selector: 'app-iconos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './iconos.component.html',
  styleUrls: ['./iconos.component.css']
})
export class IconosComponent {
  
  @ViewChild('container') containerRef!: ElementRef;

  // Variables de posición
  top: number = 0;
  left: number = 0;
  
  // Estados
  isDraggingMode = false;
  hasMoved = false; // Bandera para saber si el usuario ya lo movió
  
  private holdTimer: any;
  private dragOffset = { x: 0, y: 0 };

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  onMouseDown(event: MouseEvent | TouchEvent) {
    // Si es la primera vez que se toca, calculamos la posición actual real
    // para que no salte de golpe.
    if (!this.hasMoved && this.containerRef) {
      const rect = this.containerRef.nativeElement.getBoundingClientRect();
      this.top = rect.top;
      this.left = rect.left;
    }

    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;

    this.dragOffset.x = clientX - this.left;
    this.dragOffset.y = clientY - this.top;

    // Timer para activar modo arrastre
    this.holdTimer = setTimeout(() => {
      this.isDraggingMode = true;
    }, 300); // 300ms manteniendo presionado para arrastrar
  }

  onMouseMove(event: MouseEvent | TouchEvent) {
    if (!this.isDraggingMode) return;
    
    // Evitar scroll en móviles mientras arrastras
    if(event.cancelable) event.preventDefault();

    this.hasMoved = true; // Confirmamos que se ha movido manualmente

    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;

    this.left = clientX - this.dragOffset.x;
    this.top = clientY - this.dragOffset.y;
  }

  onMouseUp() {
    clearTimeout(this.holdTimer);
    setTimeout(() => {
      this.isDraggingMode = false;
    }, 0);
  }

  handleLinkClick(network: string) {
    // Si estaba arrastrando, NO abrir el link
    if (this.isDraggingMode) return;

    if (network === 'whatsapp') {
      window.open('https://wa.me/549XXXXXXX', '_blank');
    } else if (network === 'instagram') {
      window.open('https://instagram.com/TU_USUARIO', '_blank');
    }
  }
}