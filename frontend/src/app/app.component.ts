import { Component, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { IconosComponent } from './shared/iconos/iconos.component';
import { CommonModule } from '@angular/common';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivityService } from './services/activity.service';

/** Rutas donde NO se muestra navbar/footer global */
const AUTH_ROUTES = ['/auth/login', '/auth/register', '/admin'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, IconosComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'YVAGA';

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  isAuthPage = computed(() =>
    AUTH_ROUTES.some(route => this.currentUrl().startsWith(route))
  );

  constructor(private router: Router, private activitySvc: ActivityService) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const nav = e as NavigationEnd;
      if (!nav.urlAfterRedirects.startsWith('/admin')) {
        this.activitySvc.recordActivity('page_view', nav.urlAfterRedirects);
      }
    });
  }
}