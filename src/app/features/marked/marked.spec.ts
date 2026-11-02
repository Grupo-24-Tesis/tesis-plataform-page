import { of, throwError } from 'rxjs';

import { Marked } from './marked';
import { MarkedPerson } from '../../core/services/api.service';

const VIDEOS_KEY = 'facecluster-monitor-videos-v1';
const SAVED_KEY = 'facecluster-saved-clusters-v1';

/** PR-01 – Personas marcadas: API + detecciones guardadas localmente (todo simulado). */
describe('Marked', () => {
  let api: Record<'getMarked' | 'getFaceAppearances' | 'createMarked' | 'deleteMarked', ReturnType<typeof vi.fn>>;
  let alertMock: ReturnType<typeof vi.fn>;

  const appearance = (faceId: string, frameUrl = `url-${faceId}`) => ({ faceId, timestamp: '00:00:01', cameraId: 'c1', frameUrl });
  const remote = (id: string, faceId = 'f1'): MarkedPerson => ({ id, faceId, reason: 'Sospechoso' });

  const create = () => {
    const component = new Marked(api as any);
    component.ngOnInit();
    return component;
  };

  const seedLocal = (savedIds: string[], videos: unknown[]) => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds));
    localStorage.setItem(VIDEOS_KEY, JSON.stringify(videos));
  };

  const localVideo = {
    id: 'v1', cameraId: 'c1', fileName: 'camara.mp4', processedAt: 'x',
    clusters: [
      { clusterId: 'person_001', appearances: [appearance('person_001')] },
      { clusterId: 'vacio', appearances: [] },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    api = {
      getMarked: vi.fn().mockReturnValue(of([])),
      getFaceAppearances: vi.fn().mockReturnValue(of([])),
      createMarked: vi.fn(),
      deleteMarked: vi.fn(),
    };
    alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('carga inicial', () => {
    it('carga las personas marcadas de la API', () => {
      api.getMarked.mockReturnValue(of([remote('m1'), remote('m2', 'f2')]));

      const component = create();

      expect(component.marked().map(m => m.id)).toEqual(['m1', 'm2']);
    });

    it('arma la lista de personas únicas con la primera aparición de cada cara', () => {
      api.getFaceAppearances.mockReturnValue(of([
        appearance('f1', 'primera'), appearance('f2'), appearance('f1', 'segunda'),
      ]));

      const component = create();

      expect(component.people().map(p => p.faceId)).toEqual(['f1', 'f2']);
      expect(component.people()[0].appearance.frameUrl).toBe('primera');
    });

    it('si fallan las APIs no rompe', () => {
      api.getMarked.mockReturnValue(throwError(() => new Error('x')));
      api.getFaceAppearances.mockReturnValue(throwError(() => new Error('x')));

      const component = create();

      expect(component.marked()).toEqual([]);
      expect(component.people()).toEqual([]);
    });
  });

  describe('detecciones guardadas localmente', () => {
    it('las incluye como marcados LOCAL: junto con los de la API', () => {
      seedLocal(['v1:person_001'], [localVideo]);
      api.getMarked.mockReturnValue(of([remote('m1')]));

      const component = create();

      expect(component.marked().map(m => m.id)).toEqual(['m1', 'LOCAL:v1:person_001']);
      const local = component.marked()[1];
      expect(local.faceId).toBe('person_001');
      expect(local.reason).toBe('Detección guardada desde camara.mp4');
    });

    it('agrega la persona local a la lista de personas', () => {
      seedLocal(['v1:person_001'], [localVideo]);
      api.getFaceAppearances.mockReturnValue(of([appearance('f1')]));

      const component = create();

      expect(component.people().map(p => p.faceId)).toEqual(['f1', 'person_001']);
    });

    it('ignora ids mal formados, videos o clusters inexistentes y clusters sin apariciones', () => {
      seedLocal(['sin-separador', 'otro:person_001', 'v1:no-existe', 'v1:vacio'], [localVideo]);

      const component = create();

      expect(component.marked()).toEqual([]);
    });

    it('si el JSON local está dañado no rompe', () => {
      localStorage.setItem(SAVED_KEY, '{roto');
      localStorage.setItem(VIDEOS_KEY, '[]');

      expect(() => create()).not.toThrow();
    });

    it('si los datos locales no son listas los ignora', () => {
      seedLocal([], []);
      localStorage.setItem(SAVED_KEY, JSON.stringify({ no: 'lista' }));

      const component = create();

      expect(component.marked()).toEqual([]);
    });
  });

  describe('modal y selección', () => {
    it('openModal reinicia el formulario y lo muestra', () => {
      const component = create();
      component.reason = 'vieja';

      component.openModal();

      expect(component.showModal()).toBe(true);
      expect(component.reason).toBe('');
      expect(component.selectedPerson()).toBeNull();
    });

    it('selectPerson y closeModal', () => {
      const component = create();
      const person = { faceId: 'f1', appearance: appearance('f1') };

      component.openModal();
      component.selectPerson(person);
      expect(component.selectedPerson()).toBe(person);

      component.closeModal();
      expect(component.showModal()).toBe(false);
      expect(component.selectedPerson()).toBeNull();
    });

    it('getPersonImage devuelve la imagen o undefined', () => {
      api.getFaceAppearances.mockReturnValue(of([appearance('f1', 'url-1')]));
      const component = create();

      expect(component.getPersonImage('f1')).toBe('url-1');
      expect(component.getPersonImage('zzz')).toBeUndefined();
    });
  });

  describe('createMarked', () => {
    it('avisa si no hay persona seleccionada', () => {
      const component = create();
      component.reason = 'algo';

      component.createMarked();

      expect(alertMock).toHaveBeenCalledWith('Seleccione una persona');
      expect(api.createMarked).not.toHaveBeenCalled();
    });

    it.each(['', '   '])('avisa si la razón es "%s"', reason => {
      const component = create();
      component.selectPerson({ faceId: 'f1', appearance: appearance('f1') });
      component.reason = reason;

      component.createMarked();

      expect(alertMock).toHaveBeenCalledWith('Ingrese una razón');
      expect(api.createMarked).not.toHaveBeenCalled();
    });

    it('crea el marcado con la razón recortada, lo agrega y cierra el modal', () => {
      const created = remote('m9');
      api.createMarked.mockReturnValue(of(created));
      const component = create();
      component.openModal();
      component.selectPerson({ faceId: 'f1', appearance: appearance('f1') });
      component.reason = '  Comportamiento sospechoso  ';

      component.createMarked();

      expect(api.createMarked).toHaveBeenCalledWith({ faceId: 'f1', reason: 'Comportamiento sospechoso' });
      expect(component.marked()).toContainEqual(created);
      expect(component.showModal()).toBe(false);
    });

    it('si la API falla el modal queda abierto y no agrega nada', () => {
      api.createMarked.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      component.openModal();
      component.selectPerson({ faceId: 'f1', appearance: appearance('f1') });
      component.reason = 'motivo';

      component.createMarked();

      expect(component.showModal()).toBe(true);
      expect(component.marked()).toEqual([]);
    });
  });

  describe('deleteMarked', () => {
    it('elimina un marcado de la API y de la lista', () => {
      api.getMarked.mockReturnValue(of([remote('m1'), remote('m2', 'f2')]));
      api.deleteMarked.mockReturnValue(of(undefined));
      const component = create();

      component.deleteMarked(remote('m1'));

      expect(api.deleteMarked).toHaveBeenCalledWith('m1');
      expect(component.marked().map(m => m.id)).toEqual(['m2']);
    });

    it('si la API falla conserva el marcado', () => {
      api.getMarked.mockReturnValue(of([remote('m1')]));
      api.deleteMarked.mockReturnValue(throwError(() => new Error('x')));
      const component = create();

      component.deleteMarked(remote('m1'));

      expect(component.marked()).toHaveLength(1);
    });

    it('un marcado sin id no llama a la API', () => {
      const component = create();

      component.deleteMarked({ faceId: 'f1', reason: 'x' });

      expect(api.deleteMarked).not.toHaveBeenCalled();
    });

    it('un marcado LOCAL se quita de localStorage y de la lista sin llamar a la API', () => {
      seedLocal(['v1:person_001', 'v1:otro'], [localVideo]);
      const component = create();

      component.deleteMarked({ id: 'LOCAL:v1:person_001', faceId: 'person_001', reason: 'x' });

      expect(api.deleteMarked).not.toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem(SAVED_KEY)!)).toEqual(['v1:otro']);
      expect(component.marked().some(m => m.id === 'LOCAL:v1:person_001')).toBe(false);
    });
  });
});
