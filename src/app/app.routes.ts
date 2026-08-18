import { Routes } from '@angular/router';

export const routes: Routes = [
  // Vista inicial SIN layout shell
  { path: '', redirectTo: 'guards', pathMatch: 'full' },
  { path: 'guards', loadComponent: () => import('./features/guards/guards').then(m => m.Guards) },

  // Vistas CON layout shell (hamburguesa)
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then(m => m.Shell),
    children: [
      { path: 'monitor', loadComponent: () => import('./features/monitor/monitor').then(m => m.MonitorComponent) },
      { path: 'unique-faces', loadComponent: () => import('./features/unique-faces/unique-faces').then(m => m.UniqueFaces) },
      { path: 'reports', loadComponent: () => import('./features/reports/reports').then(m => m.Reports) },
      { path: 'marked', loadComponent: () => import('./features/marked/marked').then(m => m.Marked) },
    ],
  },

  { path: '**', redirectTo: 'guards' },
];