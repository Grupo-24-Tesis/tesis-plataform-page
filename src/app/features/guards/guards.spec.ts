import { ElementRef } from '@angular/core';
import { of, throwError } from 'rxjs';

import { Guards } from './guards';
import { Guard } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

/** PR-01 – Selección y registro de vigilantes (API simulada, sin backend). */
describe('Guards', () => {
  let api: { getGuards: ReturnType<typeof vi.fn>; createGuard: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let session: SessionService;
  let dialog: { showModal: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  const ana: Guard = { id: '1', name: 'Ana Pérez', shift: 'noche', schedule: '22-06' };

  const create = (initialGuards: Guard[] = [ana]) => {
    api.getGuards.mockReturnValue(of(initialGuards));
    const component = new Guards(api as any, session, router as any);
    component.guardDialog = { nativeElement: dialog } as unknown as ElementRef<HTMLDialogElement>;
    component.ngOnInit();
    return component;
  };

  beforeEach(() => {
    localStorage.clear();
    api = { getGuards: vi.fn(), createGuard: vi.fn() };
    router = { navigateByUrl: vi.fn() };
    session = new SessionService();
    dialog = { showModal: vi.fn(), close: vi.fn() };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe('ngOnInit', () => {
    it('carga los vigilantes y termina el estado de carga', () => {
      const component = create();

      expect(component.guards()).toEqual([ana]);
      expect(component.loading).toBe(false);
      expect(component.errorMsg).toBe('');
    });

    it('si la API falla, deja la lista vacía y muestra el error', () => {
      api.getGuards.mockReturnValue(throwError(() => new Error('500')));
      const component = new Guards(api as any, session, router as any);

      component.ngOnInit();

      expect(component.guards()).toEqual([]);
      expect(component.errorMsg).toBe('No se pudieron cargar los vigilantes.');
      expect(component.loading).toBe(false);
    });
  });

  describe('initials', () => {
    it.each([
      ['Juan Carlos Pérez', 'JC'],
      ['  ana   maría  ', 'AM'],
      ['pedro', 'P'],
      ['luis alberto gómez ruiz', 'LA'],
    ])('"%s" -> "%s"', (name, expected) => {
      expect(create().initials(name)).toBe(expected);
    });
  });

  describe('startShift', () => {
    it('sin vigilante seleccionado no hace nada', () => {
      const component = create();

      component.startShift();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(session.getActiveGuard()).toBeNull();
    });

    it('un vigilante sin id no inicia turno', () => {
      const component = create();
      component.selectGuard({ name: 'Sin id', shift: '', schedule: '' });

      component.startShift();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('guarda la sesión y navega a /monitor', () => {
      const component = create();
      component.selectGuard(ana);

      component.startShift();

      expect(session.getActiveGuard()).toBe('1');
      expect(JSON.parse(localStorage.getItem('facecluster-active-guard')!)).toEqual(ana);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/monitor');
    });
  });

  describe('diálogo de nuevo vigilante', () => {
    it('openGuardDialog limpia los campos y abre el diálogo', () => {
      const component = create();
      component.newGuardName = 'viejo';
      component.errorMsg = 'error previo';

      component.openGuardDialog();

      expect(component.newGuardName).toBe('');
      expect(component.errorMsg).toBe('');
      expect(dialog.showModal).toHaveBeenCalledOnce();
    });

    it('closeGuardDialog cierra y limpia', () => {
      const component = create();
      component.newGuardName = 'algo';

      component.closeGuardDialog();

      expect(dialog.close).toHaveBeenCalledOnce();
      expect(component.newGuardName).toBe('');
    });

    it('no falla si el diálogo aún no existe en el DOM', () => {
      const component = create();
      component.guardDialog = undefined;

      expect(() => component.openGuardDialog()).not.toThrow();
      expect(() => component.closeGuardDialog()).not.toThrow();
    });
  });

  describe('addGuard', () => {
    it.each(['', '  ', 'ab', ' a  '])('rechaza el nombre "%s" (menos de 3 caracteres)', name => {
      const component = create();
      component.newGuardName = name;

      component.addGuard();

      expect(component.errorMsg).toBe('Escribe un nombre de al menos tres caracteres.');
      expect(api.createGuard).not.toHaveBeenCalled();
    });

    it('rechaza un nombre repetido sin distinguir mayúsculas ni espacios extra', () => {
      const component = create();
      component.newGuardName = '  ANA   pérez ';

      component.addGuard();

      expect(component.errorMsg).toBe('Este vigilante ya está registrado.');
      expect(api.createGuard).not.toHaveBeenCalled();
    });

    it('crea el vigilante con turno y horario por defecto y lo selecciona', () => {
      const created: Guard = { id: '2', name: 'Luis Gómez', shift: 'Sin asignar', schedule: 'Horario no definido' };
      api.createGuard.mockReturnValue(of(created));
      const component = create();
      component.newGuardName = '  Luis    Gómez ';

      component.addGuard();

      expect(api.createGuard).toHaveBeenCalledWith({
        name: 'Luis Gómez',
        shift: 'Sin asignar',
        schedule: 'Horario no definido',
      });
      expect(component.guards()).toEqual([ana, created]);
      expect(component.selectedGuard()).toEqual(created);
      expect(dialog.close).toHaveBeenCalled();
    });

    it('si la API falla muestra el error y no agrega nada', () => {
      api.createGuard.mockReturnValue(throwError(() => new Error('500')));
      const component = create();
      component.newGuardName = 'Luis Gómez';

      component.addGuard();

      expect(component.errorMsg).toBe('No se pudo registrar el vigilante.');
      expect(component.guards()).toEqual([ana]);
      expect(component.selectedGuard()).toBeNull();
    });
  });
});
