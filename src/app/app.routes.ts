import { Routes } from '@angular/router';

export const routes: Routes = [
  // Ruta inicial
  {
    path: '',
    redirectTo: '/guards',
    pathMatch: 'full'
  },
  // Selección de vigilante
  {
    path: 'guards',
    loadComponent: () =>
      import('./features/guards/guards').then(m => m.Guards)
  },

  // Aplicación principal
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell').then(m => m.Shell),
    children: [
      {
        path: 'monitor',
        loadComponent: () =>
          import('./features/monitor/monitor').then(m => m.MonitorComponent)
      },
      {
        path: 'unique-faces',
        loadComponent: () =>
          import('./features/unique-faces/unique-faces').then(m => m.UniqueFaces)
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports').then(m => m.Reports)
      },
      {
        path: 'marked',
        loadComponent: () =>
          import('./features/marked/marked').then(m => m.Marked)
      }
    ]
  },

  

  // Cualquier ruta desconocida
  {
    path: '**',
    redirectTo: 'guards'
  }
];