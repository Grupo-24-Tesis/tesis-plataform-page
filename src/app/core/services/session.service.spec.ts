import { TestBed } from '@angular/core/testing';

import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
  });

  afterEach(() => localStorage.clear());

  it('devuelve null cuando no hay vigilante activo', () => {
    expect(service.getActiveGuard()).toBeNull();
  });

  it('guarda y recupera el id y el nombre del vigilante', () => {
    service.setActiveGuard({ id: 'g1', name: 'Laura' });

    expect(service.getActiveGuard()).toEqual({ id: 'g1', name: 'Laura' });
  });

  it('solo escribe una clave en el almacenamiento', () => {
    service.setActiveGuard({ id: 'g1', name: 'Laura' });

    expect(localStorage.length).toBe(1);
  });

  it('ignora datos corruptos', () => {
    localStorage.setItem('activeGuard', '{no-json');

    expect(service.getActiveGuard()).toBeNull();
  });

  it('limpia la sesion y la clave antigua', () => {
    service.setActiveGuard({ id: 'g1', name: 'Laura' });
    localStorage.setItem('facecluster-active-guard', '{"id":"g1"}');

    service.clearActiveGuard();

    expect(service.getActiveGuard()).toBeNull();
    expect(localStorage.getItem('facecluster-active-guard')).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
