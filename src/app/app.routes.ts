import { Routes } from '@angular/router';

import { Layout } from './features/layout/layout';
import { Upload } from './features/upload/upload';
import { Results } from './features/results/results';


export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: 'upload', component: Upload },
      { path: 'results', component: Results },
      { path: '', redirectTo: 'upload', pathMatch: 'full' },
      { path: '**', redirectTo: 'upload' } 
    ]
  }
];