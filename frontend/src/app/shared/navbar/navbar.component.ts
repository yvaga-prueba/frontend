import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ViewportScroller } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  private router = inject(Router);
  private scroller = inject(ViewportScroller);

  goHome() {
    this.router.navigateByUrl('/');
  }
  isMenuOpen = false;

  async goToSection(id: string) {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    if (this.router.url.split('#')[0] !== '/') {
      await this.router.navigate(['/'], { fragment: id });
      // pequeño delay para asegurar render del Home
      setTimeout(() => this.scroller.scrollToAnchor(id), 0);
    } else {
      // si ya estamos en Home, scrollear directo
      this.scroller.scrollToAnchor(id);
      history.replaceState(null, '', `#${id}`);
    }
  }

  
}