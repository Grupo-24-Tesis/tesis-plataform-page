import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ActivityResponse } from '../../core/models/activity.model';
import { ApiService } from '../../core/services/api.service';
import { Activity } from './activity';

function response(counts: Record<number, number>): ActivityResponse {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: counts[hour] ?? 0 }));
  const total = hours.reduce((sum, entry) => sum + entry.count, 0);

  return {
    hours,
    cameras: total === 0 ? [] : [
      { cameraId: 'CAM-01', cameraName: 'Entrada', count: total - 2 },
      { cameraId: 'CAM-02', cameraName: 'Garaje', count: 2 }
    ],
    total
  };
}

describe('Activity', () => {
  let fixture: ComponentFixture<Activity>;
  let component: Activity;
  let api: {
    getActivity: ReturnType<typeof vi.fn>;
    getCameras: ReturnType<typeof vi.fn>;
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Activity],
      providers: [{ provide: ApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(Activity);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    api = {
      getActivity: vi.fn(() => of(response({ 8: 3, 18: 14 }))),
      getCameras: vi.fn(() => of([{ id: 'CAM-01', name: 'Entrada', active: true }]))
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('carga la actividad sin filtros y la lista de camaras', async () => {
    await create();

    expect(api.getActivity).toHaveBeenCalledWith(undefined, undefined, undefined);
    expect(root().querySelectorAll('#activityCamera option').length).toBe(2);
  });

  it('envia los filtros al aplicar y los borra al limpiar', async () => {
    await create();
    component.cameraId = 'CAM-01';
    component.startDate = '2026-05-01';
    component.endDate = '2026-05-31';

    component.applyFilters();
    await fixture.whenStable();
    expect(api.getActivity).toHaveBeenLastCalledWith('CAM-01', '2026-05-01', '2026-05-31');

    component.clearFilters();
    await fixture.whenStable();
    expect(api.getActivity).toHaveBeenLastCalledWith(undefined, undefined, undefined);
    expect(component.cameraId).toBe('');
  });

  it('dibuja 24 barras con alturas proporcionales a los conteos', async () => {
    await create();

    const bars = Array.from(root().querySelectorAll('rect.bar'));
    const heights = bars.map(bar => Number(bar.getAttribute('height')));

    expect(bars.length).toBe(24);
    expect(heights[18]).toBeCloseTo(150);
    expect(heights[8]).toBeCloseTo(150 * 3 / 14);
    expect(heights[0]).toBe(0);
    expect(bars[18].querySelector('title')?.textContent).toContain('14');
  });

  it('muestra una etiqueta cada tres horas', async () => {
    await create();

    const labels = Array.from(root().querySelectorAll('text.tick')).map(
      label => label.textContent?.trim()
    );

    expect(labels).toEqual(['0', '3', '6', '9', '12', '15', '18', '21']);
  });

  it('resume el maximo en el aria-label del grafico', async () => {
    await create();

    expect(root().querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe(
      'Detecciones por hora: el máximo es 14 a las 18 h'
    );
  });

  it('muestra la tabla de camaras con el total', async () => {
    await create();

    const rows = Array.from(root().querySelectorAll('tbody tr')).map(row => row.textContent);

    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Entrada');
    expect(rows[0]).toContain('15');
    expect(root().querySelector('tfoot')?.textContent).toContain('17');
  });

  it('muestra el estado vacio cuando todo es cero', async () => {
    api.getActivity.mockReturnValue(of(response({})));

    await create();

    expect(root().querySelector('svg')).toBeNull();
    expect(root().textContent).toContain('No hay detecciones en el rango seleccionado');
  });

  it('muestra Cargando mientras espera', async () => {
    api.getActivity.mockReturnValue(new Subject());

    await create();

    expect(root().textContent).toContain('Cargando...');
    expect(root().querySelector('svg')).toBeNull();
  });

  it('muestra el error con Reintentar que vuelve a cargar', async () => {
    api.getActivity.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Fecha inválida' } }))
    );

    await create();

    expect(root().textContent).toContain('Fecha inválida');
    expect(root().textContent).not.toContain('No hay detecciones');

    const retry = Array.from(root().querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Reintentar'
    ) as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();

    expect(api.getActivity).toHaveBeenCalledTimes(2);
    expect(root().querySelector('svg')).not.toBeNull();
  });
});
