import { Component, Inject, PLATFORM_ID, ElementRef, ViewChild, HostListener } from '@angular/core';
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
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Chequeamos si estamos en el navegador para que no de error en el servidor (SSR)
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // MAGIA 1: Si la pantalla cambia de tamaño (zoom), obligamos a los iconos a volver adentro
  @HostListener('window:resize')
  onResize() {
    if (this.hasMoved && this.isBrowser) {
      this.checkBoundaries();
    }
  }

  onMouseDown(event: MouseEvent | TouchEvent) {
    if (!this.isBrowser) return;

    // Si es la primera vez que se toca, calculamos la posición actual real
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
    if (!this.isDraggingMode || !this.isBrowser) return;
    
    // Evitar scroll en móviles mientras arrastras
    if(event.cancelable) event.preventDefault();

    this.hasMoved = true; 

    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;

    this.left = clientX - this.dragOffset.x;
    this.top = clientY - this.dragOffset.y;

    // MAGIA 2: Frenamos los iconos si tocan los bordes
    this.checkBoundaries();
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

  // Función de límites matemáticos
  private checkBoundaries() {
    if (!this.isBrowser) return;
    
    const iconWidth = 75; // Ancho aproximado ocupado
    const iconHeight = 150; // Alto aproximado (2 botones + espacio)
    
    const maxLeft = window.innerWidth - iconWidth;
    const maxTop = window.innerHeight - iconHeight;

    if (this.left < 0) this.left = 0;
    if (this.top < 0) this.top = 0;
    if (this.left > maxLeft) this.left = maxLeft;
    if (this.top > maxTop) this.top = maxTop;
  }
}