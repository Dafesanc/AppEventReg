import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'admin', loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin) },
  {
    path: 'pago/confirmacion',
    loadComponent: () => import('./pages/payment-result/payment-result').then((m) => m.PaymentResult),
  },
  { path: '**', redirectTo: '' },
];
