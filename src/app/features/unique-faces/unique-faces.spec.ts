import { of, throwError } from 'rxjs';

import { UniqueFaces } from './unique-faces';
import { UniqueFace } from '../../core/models/UniqueFace';

/** PR-01 – Listado y filtros de personas únicas (API simulada). */
describe('UniqueFaces', () => {
  let api: { getUniqueFaces: ReturnType<typeof vi.fn>; getCameras: ReturnType<typeof vi.fn> };

  const face = (faceId: string): UniqueFace => ({ faceId, appearances: [], reportCount: 0, suspect: false });
  const cameras = [{ id: 'c1', name: 'Entrada', active: true }];

  const create = () => {
    const component = new UniqueFaces(api as any);
    component.ngOnInit();
    return component;
  };

  beforeEach(() => {
    api = {
      getUniqueFaces: vi.fn().mockReturnValue(of([face('f1'), face('f2')])),
      getCameras: vi.fn().mockReturnValue(of(cameras)),
    };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe('carga inicial', () => {
    it('carga las caras y las cámaras', () => {
      const component = create();

      expect(component.faces().map(f => f.faceId)).toEqual(['f1', 'f2']);
      expect(component.cameras()).toEqual(cameras);
    });

    it('sin filtros consulta con todo en undefined', () => {
      create();

      expect(api.getUniqueFaces).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
    });

    it('si falla la carga de caras no rompe y deja la lista vacía', () => {
      api.getUniqueFaces.mockReturnValue(throwError(() => new Error('x')));

      const component = create();

      expect(component.faces()).toEqual([]);
    });

    it('si falla la carga de cámaras no rompe', () => {
      api.getCameras.mockReturnValue(throwError(() => new Error('x')));

      const component = create();

      expect(component.cameras()).toEqual([]);
    });
  });

  describe('getCameraName', () => {
    it('devuelve el nombre de la cámara conocida', () => {
      expect(create().getCameraName('c1')).toBe('Entrada');
    });

    it('devuelve un texto por defecto si la cámara no existe', () => {
      expect(create().getCameraName('zzz')).toBe('Cámara no identificada');
    });
  });

  describe('filtros', () => {
    it.each([
      ['true', true],
      ['false', false],
      ['', undefined],
    ])('hasReports="%s" se envía como %s', (value, expected) => {
      const component = create();
      component.hasReports = value;

      component.loadFaces();

      expect(api.getUniqueFaces).toHaveBeenLastCalledWith(undefined, undefined, expected, undefined);
    });

    it.each([
      ['true', true],
      ['false', false],
      ['', undefined],
    ])('suspect="%s" se envía como %s', (value, expected) => {
      const component = create();
      component.suspect = value;

      component.loadFaces();

      expect(api.getUniqueFaces).toHaveBeenLastCalledWith(undefined, undefined, undefined, expected);
    });

    it('envía las fechas cuando están definidas', () => {
      const component = create();
      component.startDate = '2026-10-01';
      component.endDate = '2026-10-05';

      component.loadFaces();

      expect(api.getUniqueFaces).toHaveBeenLastCalledWith('2026-10-01', '2026-10-05', undefined, undefined);
    });

    it('applyFilters cierra el detalle y vuelve a consultar', () => {
      const component = create();
      component.selected.set(face('f1'));

      component.applyFilters();

      expect(component.selected()).toBeNull();
      expect(api.getUniqueFaces).toHaveBeenCalledTimes(2);
    });

    it('clearFilters reinicia todos los campos y recarga', () => {
      const component = create();
      component.startDate = '2026-10-01';
      component.endDate = '2026-10-05';
      component.hasReports = 'true';
      component.suspect = 'false';
      component.selected.set(face('f1'));

      component.clearFilters();

      expect([component.startDate, component.endDate, component.hasReports, component.suspect]).toEqual(['', '', '', '']);
      expect(component.selected()).toBeNull();
      expect(api.getUniqueFaces).toHaveBeenLastCalledWith(undefined, undefined, undefined, undefined);
    });
  });

  describe('detalle de una cara', () => {
    let timeoutCallback: () => void;
    let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      setTimeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation(((cb: () => void) => {
        timeoutCallback = cb;
        return 1;
      }) as any);
    });

    it('seleccionar una cara la muestra', () => {
      const component = create();

      component.selectFace(face('f1'));

      expect(component.selected()?.faceId).toBe('f1');
      expect(component.detailClosing).toBe(false);
    });

    it('seleccionar otra cara reemplaza la anterior', () => {
      const component = create();
      component.selectFace(face('f1'));

      component.selectFace(face('f2'));

      expect(component.selected()?.faceId).toBe('f2');
    });

    it('seleccionar la misma cara inicia el cierre animado (160 ms)', () => {
      const component = create();
      component.selectFace(face('f1'));

      component.selectFace(face('f1'));

      expect(component.detailClosing).toBe(true);
      expect(component.selected()?.faceId).toBe('f1');
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 160);

      timeoutCallback();

      expect(component.selected()).toBeNull();
      expect(component.detailClosing).toBe(false);
    });

    it('closeDetail sin nada seleccionado no hace nada', () => {
      const component = create();

      component.closeDetail();

      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it('closeDetail no se repite mientras ya se está cerrando', () => {
      const component = create();
      component.selectFace(face('f1'));

      component.closeDetail();
      component.closeDetail();

      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
