import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { ReportDetail } from './report-detail';

const REPORT = {
  id: 'r1',
  title: 'Robo en el parqueadero',
  status: 'solucionado',
  priority: 'alta',
  description: 'Se vio a alguien forzar un candado',
  incidentDate: '2026-01-01T10:00:00',
  createdAt: '2026-01-02T08:30:00',
  resolvedAt: '2026-01-03T09:15:00',
  resolutionDescription: 'Se recupero el objeto',
  faceIds: ['job-1_1', 'job-1_2'],
  createdByGuardId: 'g1'
};

const FACE = {
  faceId: 'job-1_1',
  jobId: 'job-1',
  timestamp: '00:01:23',
  cameraId: 'CAM-01',
  capturedAt: '2026-01-01T10:05:00',
  frameUrl: 'https://x/1.jpg'
};

describe('ReportDetail', () => {
  let fixture: ComponentFixture<ReportDetail>;
  let component: ReportDetail;
  let navigate: ReturnType<typeof vi.fn>;
  let api: {
    getReport: ReturnType<typeof vi.fn>;
    getGuards: ReturnType<typeof vi.fn>;
    getCameras: ReturnType<typeof vi.fn>;
    getFaceAppearancesByIds: ReturnType<typeof vi.fn>;
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ReportDetail],
      providers: [
        { provide: ApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r1' }) } }
        },
        { provide: Router, useValue: { navigate } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function query(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  beforeEach(() => {
    navigate = vi.fn(() => Promise.resolve(true));
    api = {
      getReport: vi.fn(() => of(REPORT)),
      getGuards: vi.fn(() => of([{ id: 'g1', name: 'Marta', shift: '', schedule: '' }])),
      getCameras: vi.fn(() => of([{ id: 'CAM-01', name: 'Entrada', active: true }])),
      getFaceAppearancesByIds: vi.fn(() => of([FACE]))
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the report fields, the author and the resolution', async () => {
    await create();

    expect(text()).toContain('Robo en el parqueadero');
    expect(query('.fact-status').textContent).toContain('Solucionado');
    expect(query('.fact-priority').textContent).toContain('alta');
    expect(query('.fact-incident').textContent).toContain('01/01/2026 10:00');
    expect(query('.fact-created').textContent).toContain('02/01/2026 08:30');
    expect(query('.fact-resolved').textContent).toContain('03/01/2026 09:15');
    expect(query('.fact-author').textContent).toContain('Marta');
    expect(query('.description').textContent).toContain('forzar un candado');
    expect(query('.resolution').textContent).toContain('Se recupero el objeto');
  });

  it('shows Sin registro when the report has no author or the guard is unknown', async () => {
    api.getReport.mockReturnValue(of({ ...REPORT, createdByGuardId: undefined }));
    await create();

    expect(query('.fact-author').textContent).toContain('Sin registro');
  });

  it('shows Sin registro when the guard does not exist', async () => {
    api.getReport.mockReturnValue(of({ ...REPORT, createdByGuardId: 'g-borrado' }));
    await create();

    expect(query('.fact-author').textContent).toContain('Sin registro');
  });

  it('omits the resolution for a report under investigation', async () => {
    api.getReport.mockReturnValue(of({
      ...REPORT,
      status: 'investigacion',
      resolvedAt: undefined,
      resolutionDescription: undefined
    }));
    await create();

    expect(query('.fact-resolved')).toBeNull();
    expect(query('.resolution')).toBeNull();
    expect(query('.fact-status').textContent).toContain('En investigación');
  });

  it('renders each involved detection with camera, time and position', async () => {
    await create();

    expect(api.getFaceAppearancesByIds).toHaveBeenCalledWith(['job-1_1', 'job-1_2']);

    const cards = fixture.nativeElement.querySelectorAll('.detection');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('img').getAttribute('src')).toBe('https://x/1.jpg');
    expect(cards[0].querySelector('.detection-camera').textContent).toContain('Entrada');
    expect(cards[0].querySelector('.detection-date').textContent).toContain('01/01/2026 10:05:00');
    expect(cards[0].querySelector('.detection-position').textContent).toContain('00:01:23');
    expect(cards[1].textContent).toContain('Detección no disponible.');
  });

  it('requests the detections in chunks of 50 ids', async () => {
    const faceIds = Array.from({ length: 120 }, (_, index) => `job-1_${index}`);
    api.getReport.mockReturnValue(of({ ...REPORT, faceIds }));
    api.getFaceAppearancesByIds.mockReturnValue(of([]));
    await create();

    expect(api.getFaceAppearancesByIds).toHaveBeenCalledTimes(3);
    expect(api.getFaceAppearancesByIds.mock.calls.map(call => call[0].length)).toEqual([50, 50, 20]);
  });

  it('shows the empty text when the report has no detections', async () => {
    api.getReport.mockReturnValue(of({ ...REPORT, faceIds: [] }));
    await create();

    expect(api.getFaceAppearancesByIds).not.toHaveBeenCalled();
    expect(text()).toContain('Este reporte no tiene detecciones involucradas.');
  });

  it('shows the loading state first', async () => {
    api.getReport.mockReturnValue(new Subject());
    await create();

    expect(text()).toContain('Cargando...');
    expect(query('.print-button')).toBeNull();
  });

  it('shows the backend error and retries through the same load path', async () => {
    api.getReport.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 404,
        error: { status: 404, message: 'Reporte no encontrado' }
      }))
    );
    await create();

    expect(text()).toContain('Reporte no encontrado');
    expect(query('.fact-status')).toBeNull();

    (query('.state .print-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(api.getReport).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Robo en el parqueadero');
  });

  it('shows the detections error inside its section and keeps the report', async () => {
    api.getFaceAppearancesByIds.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 503,
        error: { status: 503, message: 'No fue posible consultar las imágenes en S3' }
      }))
    );
    await create();

    expect(text()).toContain('Robo en el parqueadero');
    expect(text()).toContain('No fue posible consultar las imágenes en S3');
  });

  it('prints through window.print', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await create();

    const button = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find(candidate => candidate.textContent?.trim() === 'Imprimir');

    button!.click();

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('goes back to the reports list', async () => {
    await create();

    const button = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find(candidate => candidate.textContent?.trim() === 'Volver');

    button!.click();

    expect(navigate).toHaveBeenCalledWith(['/reports']);
  });

  it('refetches the detections after ten minutes keeping the cards, and stops on destroy', async () => {
    vi.useFakeTimers();
    await create();
    expect(api.getFaceAppearancesByIds).toHaveBeenCalledTimes(1);

    const pending = new Subject<unknown[]>();
    api.getFaceAppearancesByIds.mockReturnValue(pending);

    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    expect(api.getFaceAppearancesByIds).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(api.getFaceAppearancesByIds).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelectorAll('.detection img').length).toBe(1);

    pending.next([{ ...FACE, frameUrl: 'https://x/nueva.jpg' }]);
    pending.complete();
    fixture.detectChanges();
    expect(query('.detection img').getAttribute('src')).toBe('https://x/nueva.jpg');

    fixture.destroy();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(api.getFaceAppearancesByIds).toHaveBeenCalledTimes(2);
  });

  it('ignores a late response from an older request', async () => {
    vi.useFakeTimers();
    await create();

    const first = new Subject<unknown[]>();
    const second = new Subject<unknown[]>();
    api.getFaceAppearancesByIds
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    component.loadAppearances(false);
    component.loadAppearances(false);

    second.next([{ ...FACE, frameUrl: 'https://x/segunda.jpg' }]);
    second.complete();
    first.next([{ ...FACE, frameUrl: 'https://x/primera.jpg' }]);
    first.complete();
    fixture.detectChanges();

    expect(query('.detection img').getAttribute('src')).toBe('https://x/segunda.jpg');
  });
});
