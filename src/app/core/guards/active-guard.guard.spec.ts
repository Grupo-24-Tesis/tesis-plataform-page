import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { activeGuardGuard } from './active-guard.guard';
import { SessionService } from '../services/session.service';

describe('activeGuardGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  it('redirige a /guards cuando no hay vigilante activo', () => {
    const result = TestBed.runInInjectionContext(() => activeGuardGuard(route, state));

    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/guards');
  });

  it('permite el acceso cuando hay vigilante activo', () => {
    TestBed.inject(SessionService).setActiveGuard({ id: 'g1', name: 'Laura' });

    const result = TestBed.runInInjectionContext(() => activeGuardGuard(route, state));

    expect(result).toBe(true);
  });
});
