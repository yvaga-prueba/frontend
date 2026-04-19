import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contacto.component.html',
  styleUrls: ['./contacto.component.css']
})
export class ContactoComponent {
  // Controla qué pregunta está abierta (por defecto ninguna = null)
  activeFaq = signal<number | null>(null);

  // Las preguntas y respuestas oficiales de YVAGA
  faqs = [
    {
      q: '¿Hacen envíos a todo el país?',
      a: 'Sí, realizamos envíos a toda la República Argentina. El costo y el correo se calculan automáticamente en el checkout ingresando tu código postal.'
    },
    {
      q: '¿Cuánto demora en llegar mi pedido?',
      a: 'Los pedidos se despachan en las primeras 24hs hábiles. Una vez despachado, el tiempo de tránsito suele ser de 2 a 4 días hábiles dependiendo de tu provincia.'
    },
    {
      q: '¿Cuál es la política de cambios?',
      a: 'Tenés 30 días para realizar el cambio desde que recibís el pedido. La prenda debe estar sin uso, con sus etiquetas y en su packaging original.'
    },
    {
      q: '¿Cómo sé cuál es mi talle?',
      a: 'Te recomendamos revisar la "Guía de Talles" en la página de cada producto y comparar las medidas con un pantalon o buzo que ya tengas.'
    },
    {
      q: '¿Qué medios de pago aceptan?',
      a: 'Aceptamos todas las tarjetas de débito y crédito, dinero en Mercado Pago, y ofrecemos un descuento especial si agregas cupón de vendedores oficiales de Yvaga.'
    }
  ];

  toggleFaq(index: number) {
    this.activeFaq.update(val => val === index ? null : index);
  }

  // Función para bajar suavemente al formulario
  scrollToForm() {
    const element = document.getElementById('formulario-contacto');
    element?.scrollIntoView({ behavior: 'smooth' });
  }

  enviarMensaje(event: Event) {
    event.preventDefault();
    alert('Mensaje recibido. El equipo de YVAGA te contactará pronto.');
  }
}