import { activeGuardGuard } from './core/guards/active-guard.guard';
import { routes } from './app.routes';

describe('routes', () => {
  const shell = routes.find(route => route.children);

  it('protege el shell con el guard del vigilante activo', () => {
    expect(shell?.canActivate).toEqual([activeGuardGuard]);
  });

  it('registra la actividad dentro del shell protegido', () => {
    const paths = shell?.children?.map(route => route.path);

    expect(paths).toContain('activity');
    expect(routes.some(route => route.path === 'activity')).toBe(false);
  });

  it('registra el detalle de un reporte dentro del shell protegido', () => {
    const paths = shell?.children?.map(route => route.path);

    expect(paths).toContain('reports/:id');
  });
});
