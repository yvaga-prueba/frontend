import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { AdminComponent } from './pages/admin/admin.component';
import { ProductsComponent } from './pages/products/products.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { adminGuard } from './shared/admin.guard';

// Guard de autenticación — lee el token del mismo localStorage que AuthService
export const authGuard = () => {
  const isLoggedIn = !!localStorage.getItem('yvaga_token');
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
  { path: 'products', component: ProductsComponent },
  { path: 'products/:id', component: ProductDetailComponent },
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];