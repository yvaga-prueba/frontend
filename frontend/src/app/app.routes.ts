import { Routes } from '@angular/router';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

// Guard sencillo de ejemplo (reemplazá por tu auth real)
export const authGuard = () => {
  const isLoggedIn = !!localStorage.getItem('token');
  if (!isLoggedIn) {
    inject(Router).navigate(['/auth/login']);
    return false;
  }
  return true;
};

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },
  { path: '**', redirectTo: '' }
];

// En main.ts agregá:
// bootstrapApplication(AppComponent, {
//   providers: [provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }))]
// });