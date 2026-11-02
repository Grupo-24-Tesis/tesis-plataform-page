import { SessionService } from './session.service';

/** PR-01 – Persistencia del vigilante activo en localStorage. */
describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    localStorage.clear();
    service = new SessionService();
  });

  it('guarda y recupera el vigilante activo', () => {
    service.setActiveGuard('g1');

    expect(service.getActiveGuard()).toBe('g1');
    expect(localStorage.getItem('activeGuard')).toBe('g1');
  });

  it('devuelve null si no hay vigilante activo', () => {
    expect(service.getActiveGuard()).toBeNull();
  });

  it('el último vigilante guardado reemplaza al anterior', () => {
    service.setActiveGuard('g1');
    service.setActiveGuard('g2');

    expect(service.getActiveGuard()).toBe('g2');
  });

  it('clearActiveGuard borra el id y el objeto del vigilante guardado', () => {
    service.setActiveGuard('g1');
    localStorage.setItem('facecluster-active-guard', JSON.stringify({ id: 'g1' }));

    service.clearActiveGuard();

    expect(service.getActiveGuard()).toBeNull();
    expect(localStorage.getItem('facecluster-active-guard')).toBeNull();
  });
});
