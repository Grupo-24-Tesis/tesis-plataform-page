import { Results } from './results';

/** PR-01 – Pantalla de resultados simulados (lee de localStorage). */
describe('Results', () => {
  beforeEach(() => localStorage.clear());

  it('sin resultado guardado, result queda en null', () => {
    const component = new Results();

    component.ngOnInit();

    expect(component.result).toBeNull();
  });

  it('carga el último resultado guardado', () => {
    const saved = { videoName: 'a.mp4', processedAt: '2026-10-05T10:00:00Z', clusters: [] };
    localStorage.setItem('lastMockResult', JSON.stringify(saved));
    const component = new Results();

    component.ngOnInit();

    expect(component.result).toEqual(saved);
  });

  /** Documenta el comportamiento actual: no se captura el JSON dañado. */
  it('con JSON dañado lanza SyntaxError (comportamiento actual)', () => {
    localStorage.setItem('lastMockResult', '{roto');
    const component = new Results();

    expect(() => component.ngOnInit()).toThrow(SyntaxError);
  });

  it('saveMock sin resultado no muestra mensaje', () => {
    const component = new Results();

    component.saveMock();

    expect(component.message).toBe('');
  });

  it('saveMock con resultado muestra el mensaje de guardado simulado', () => {
    const component = new Results();
    component.result = { videoName: 'a.mp4', processedAt: 'x', clusters: [] };

    component.saveMock();

    expect(component.message).toBe('Resultado guardado (simulado)');
  });
});
