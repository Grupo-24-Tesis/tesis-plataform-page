import { Route } from '@angular/router';

import { routes } from './app.routes';
import { Guards } from './features/guards/guards';
import { MonitorComponent } from './features/monitor/monitor';
import { UniqueFaces } from './features/unique-faces/unique-faces';
import { Reports } from './features/reports/reports';
import { Marked } from './features/marked/marked';
import { Shell } from './layout/shell/shell';

const load = (route: Route) => (route.loadComponent as () => Promise<unknown>)();
const shellRoute = () => routes.find(r => r.path === '' && r.children)!;
const child = (path: string) => shellRoute().children!.find(r => r.path === path)!;

/** PR-01 – Tabla de rutas de la aplicación. */
describe('app.routes', () => {
  it('la ruta inicial redirige a /guards', () => {
    const root = routes.find(r => r.path === '' && r.redirectTo);

    expect(root?.redirectTo).toBe('/guards');
    expect(root?.pathMatch).toBe('full');
  });

  it('cualquier ruta desconocida redirige a guards', () => {
    const wildcard = routes.find(r => r.path === '**');

    expect(wildcard?.redirectTo).toBe('guards');
  });

  it('/guards carga el componente Guards', async () => {
    const route = routes.find(r => r.path === 'guards')!;

    expect(await load(route)).toBe(Guards);
  });

  it('la aplicación principal carga el Shell', async () => {
    expect(await load(shellRoute())).toBe(Shell);
  });

  it('el Shell contiene las cuatro pantallas principales', () => {
    expect(shellRoute().children!.map(r => r.path)).toEqual([
      'monitor',
      'unique-faces',
      'reports',
      'marked',
    ]);
  });

  it.each([
    ['monitor', MonitorComponent],
    ['unique-faces', UniqueFaces],
    ['reports', Reports],
    ['marked', Marked],
  ])('/%s carga su componente', async (path, component) => {
    expect(await load(child(path))).toBe(component);
  });
});
