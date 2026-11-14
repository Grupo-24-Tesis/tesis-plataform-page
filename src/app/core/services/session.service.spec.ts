import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigateByUrl } }]
    });
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

  it('termina la sesion y vuelve a la seleccion cuando el vigilante ya no existe', () => {
    service.setActiveGuard({ id: 'g1', name: 'Laura' });

    const ended = service.endIfGuardMissing(new HttpErrorResponse({
      status: 400,
      error: { status: 400, message: 'El vigilante no existe' }
    }));

    expect(ended).toBe(true);
    expect(service.getActiveGuard()).toBeNull();
    expect(service.notice()).toContain('Selecciona de nuevo el vigilante');
    expect(navigateByUrl).toHaveBeenCalledWith('/guards');
  });

  it('conserva la sesion ante otros errores', () => {
    service.setActiveGuard({ id: 'g1', name: 'Laura' });

    const otherBadRequest = service.endIfGuardMissing(new HttpErrorResponse({
      status: 400,
      error: { status: 400, message: 'Falta el título' }
    }));
    const serverError = service.endIfGuardMissing(new HttpErrorResponse({
      status: 500,
      error: { status: 500, message: 'El vigilante no existe' }
    }));

    expect(otherBadRequest).toBe(false);
    expect(serverError).toBe(false);
    expect(service.getActiveGuard()).toEqual({ id: 'g1', name: 'Laura' });
    expect(service.notice()).toBe('');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('borra el aviso al iniciar una nueva sesion', () => {
    service.endIfGuardMissing(new HttpErrorResponse({
      status: 400,
      error: { status: 400, message: 'El vigilante no existe' }
    }));

    service.setActiveGuard({ id: 'g2', name: 'Marta' });

    expect(service.notice()).toBe('');
  });
});
