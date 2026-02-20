import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// import { HeaderComponent } from './shared/header/header.component'; <--- BORRAR
import { NavbarComponent } from './shared/navbar/navbar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { IconosComponent } from './shared/iconos/iconos.component'; // <--- NUEVO IMPORT

@Component({
  selector: 'app-root',
  standalone: true,
  // Agregamos IconosComponent a la lista de imports:
  imports: [RouterOutlet, NavbarComponent, FooterComponent, IconosComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'YVAGA';
}