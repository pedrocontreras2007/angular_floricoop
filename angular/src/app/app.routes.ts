import { Routes } from '@angular/router';
import { authGuard, authMatchGuard, loginGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    canMatch: [authMatchGuard],
    loadComponent: () => import('./layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'cosechas',
        loadComponent: () => import('./features/harvest/harvest.component').then(m => m.HarvestComponent)
      },
      {
        path: 'inventario',
        loadComponent: () => import('./features/inventory/inventory.component').then(m => m.InventoryComponent)
      },
      {
        path: 'alertas',
        loadComponent: () => import('./features/stock-alerts/stock-alerts.component').then(m => m.StockAlertsComponent)
      },
      {
        path: 'mermas',
        loadComponent: () => import('./features/losses/losses.component').then(m => m.LossesComponent)
      },
      {
        path: 'reportes',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      },
      { path: '**', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
