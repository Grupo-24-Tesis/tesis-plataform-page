import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ChartConfiguration } from 'chart.js';

import { ActivityResponse } from '../../core/models/activity.model';
import { ApiService } from '../../core/services/api.service';
import { ChartFactory } from '../../shared/charts/chart-factory';
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
    videos: total === 0 ? [] : [
      { jobId: 'job-1', fileName: 'Camera_ch6.mp4', uploadedAt: '2026-11-17T16:21:13Z', count: total - 2 },
      { jobId: 'job-2', fileName: 'Garaje.mp4', uploadedAt: null, count: 2 }
    ],
    followUp: { investigation: total === 0 ? 0 : 1, resolved: 0, markedOnly: 0, none: Math.max(total - 1, 0) },
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
  let charts: { canvas: HTMLCanvasElement; config: ChartConfiguration }[];

  function hourChart(): ChartConfiguration {
    const canvas = root().querySelector('app-activity-chart canvas');
    return charts.filter(chart => chart.canvas === canvas).pop()!.config;
  }

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Activity],
      providers: [
        { provide: ApiService, useValue: api },
        {
          provide: ChartFactory,
          useValue: {
            resolve: (value: string) => value,
            create: (canvas: HTMLCanvasElement, config: ChartConfiguration) => {
              charts.push({ canvas, config });
              return { destroy: () => undefined };
            }
          }
        }
      ]
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
    charts = [];
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

  it('dibuja las 24 horas con Chart.js con los conteos de cada hora', async () => {
    await create();

    const config = hourChart();
    expect(config.type).toBe('bar');
    expect(config.data.datasets[0].data.length).toBe(24);
    expect(config.data.datasets[0].data[18]).toBe(14);
    expect(config.data.datasets[0].data[8]).toBe(3);
  });

  it('resume el maximo en el aria-label del grafico por hora', async () => {
    await create();

    expect(root().querySelector('app-activity-chart canvas')?.getAttribute('aria-label')).toBe(
      'Detecciones por hora: el máximo es 14 a las 18 h'
    );
  });

  it('muestra la leyenda por camara con el total', async () => {
    await create();

    const rows = Array.from(root().querySelectorAll('app-camera-share-chart table.legend tbody tr'))
      .map(row => row.textContent);

    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Entrada');
    expect(rows[0]).toContain('15');
    expect(rows[0]).toContain('88,2 %');
    expect(root().querySelector('app-camera-share-chart table.legend tfoot')?.textContent).toContain('17');
  });

  it('pone el grafico por camara antes del grafico por hora', async () => {
    await create();

    const titles = Array.from(root().querySelectorAll('.chart-card h2')).map(title => title.textContent?.trim());
    const cards = Array.from(root().querySelectorAll('.chart-card'));

    expect(root().querySelector('h1')?.textContent?.trim()).toBe('Actividad');
    expect(titles).toEqual(['DETECCIONES POR CÁMARA', 'SEGUIMIENTO', 'DETECCIONES POR HORA DEL DÍA']);
    expect(cards[0].querySelector('app-camera-share-chart canvas')).not.toBeNull();
    expect(cards[2].querySelector('app-activity-chart')).not.toBeNull();
  });

  it('con todas las camaras muestra el grafico por camara, el seguimiento y el grafico por hora', async () => {
    await create();

    const titles = Array.from(root().querySelectorAll('.chart-card h2')).map(title => title.textContent?.trim());
    expect(titles).toEqual(['DETECCIONES POR CÁMARA', 'SEGUIMIENTO', 'DETECCIONES POR HORA DEL DÍA']);
    expect(root().querySelector('app-follow-up-chart canvas')).not.toBeNull();
    expect(root().querySelector('app-video-detections-chart')).toBeNull();
  });

  it('al aplicar una camara cambia el grafico por camara por el grafico por video', async () => {
    await create();
    component.cameraId = 'CAM-01';
    component.applyFilters();
    await fixture.whenStable();

    const titles = Array.from(root().querySelectorAll('.chart-card h2')).map(title => title.textContent?.trim());
    expect(titles).toEqual(['DETECCIONES POR VIDEO', 'SEGUIMIENTO', 'DETECCIONES POR HORA DEL DÍA']);
    expect(root().querySelector('app-camera-share-chart')).toBeNull();
    expect(Array.from(root().querySelectorAll('app-video-detections-chart tbody tr')).length).toBe(2);
    expect(component.appliedCameraId()).toBe('CAM-01');
  });

  it('mantiene las tarjetas hasta aplicar el filtro y vuelve al grafico por camara al limpiar', async () => {
    await create();
    component.cameraId = 'CAM-01';
    await fixture.whenStable();

    expect(root().querySelector('app-camera-share-chart')).not.toBeNull();

    component.applyFilters();
    await fixture.whenStable();
    expect(root().querySelector('app-video-detections-chart')).not.toBeNull();

    component.clearFilters();
    await fixture.whenStable();
    expect(root().querySelector('app-camera-share-chart')).not.toBeNull();
    expect(root().querySelector('app-video-detections-chart')).toBeNull();
  });

  it('pasa el seguimiento y el total al grafico de seguimiento', async () => {
    await create();

    const followUp = charts.filter(chart => chart.canvas === root().querySelector('app-follow-up-chart canvas')).pop()!;
    expect(followUp.config.data.datasets.map(dataset => dataset.data[0])).toEqual([0, 0, 1, 16]);
  });

  it('ordena los colores por el nombre de las camaras registradas', async () => {
    api.getCameras.mockReturnValue(of([
      { id: 'CAM-02', name: 'Garaje', active: true },
      { id: 'CAM-01', name: 'Entrada', active: true }
    ]));

    await create();

    expect(component.cameraOrder()).toEqual(['CAM-01', 'CAM-02']);
  });

  it('muestra el estado vacio cuando todo es cero', async () => {
    api.getActivity.mockReturnValue(of(response({})));

    await create();

    expect(root().querySelector('canvas')).toBeNull();
    expect(root().textContent).toContain('No hay detecciones en el rango seleccionado');
  });

  it('muestra Cargando mientras espera', async () => {
    api.getActivity.mockReturnValue(new Subject());

    await create();

    expect(root().textContent).toContain('Cargando...');
    expect(root().querySelector('canvas')).toBeNull();
  });

  it('muestra el total del encabezado solo con datos cargados sin error', async () => {
    const pending = new Subject<ActivityResponse>();
    api.getActivity.mockReturnValueOnce(pending);

    await create();

    expect(root().querySelector('.page-header p')).toBeNull();

    pending.next(response({ 8: 3, 18: 14 }));
    pending.complete();
    await fixture.whenStable();

    expect(root().querySelector('.page-header p')?.textContent).toContain('17 detecciones');

    const reload = new Subject<ActivityResponse>();
    api.getActivity.mockReturnValueOnce(reload);
    component.applyFilters();
    await fixture.whenStable();

    expect(root().querySelector('.page-header p')).toBeNull();

    reload.error(new HttpErrorResponse({ status: 500 }));
    await fixture.whenStable();

    expect(root().querySelector('.page-header p')).toBeNull();
    expect(root().textContent).toContain('No se pudo cargar la actividad.');
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
    expect(root().querySelector('canvas')).not.toBeNull();
  });
});
