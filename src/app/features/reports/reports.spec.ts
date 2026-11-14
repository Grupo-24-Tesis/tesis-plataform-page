import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { Reports } from './reports';

const REPORT = {
  id: 'r1',
  title: 'Robo',
  status: 'investigacion',
  priority: 'media',
  description: 'Descripcion',
  incidentDate: '2026-01-01T10:00:00',
  createdAt: '2026-01-02T10:00:00',
  faceIds: []
};

describe('Reports', () => {
  let component: Reports;
  let fixture: ComponentFixture<Reports>;
  let api: {
    getReports: ReturnType<typeof vi.fn>;
    getFilteredReports: ReturnType<typeof vi.fn>;
    getFaceAppearances: ReturnType<typeof vi.fn>;
    createReport: ReturnType<typeof vi.fn>;
    updateReportStatus: ReturnType<typeof vi.fn>;
  };

  let queryParams: Record<string, string> = {};
  let navigate: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [
        { provide: ApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } }
        },
        { provide: Router, useValue: { navigate, navigateByUrl } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Reports);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function fillBase(): void {
    component.openModal();
    component.newReport.title = 'Robo';
    component.newReport.description = 'Descripcion';
    component.newReport.incidentDate = '2026-01-01T10:00';
  }

  beforeEach(() => {
    queryParams = {};
    navigate = vi.fn(() => Promise.resolve(true));
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    api = {
      getReports: vi.fn(() => of([REPORT])),
      getFilteredReports: vi.fn(() => of([REPORT])),
      getFaceAppearances: vi.fn(() => of([])),
      createReport: vi.fn(() => of(REPORT)),
      updateReportStatus: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('shows the loading state and then the reports', async () => {
    const pending = new Subject<unknown[]>();
    api.getReports.mockReturnValue(pending);
    await create();

    expect(text()).toContain('Cargando...');

    pending.next([REPORT]);
    pending.complete();
    fixture.detectChanges();

    expect(text()).not.toContain('Cargando...');
    expect(text()).toContain('Robo');
  });

  it('shows the empty state when there are no reports', async () => {
    api.getReports.mockReturnValue(of([]));
    await create();

    expect(text()).toContain('No hay reportes');
    expect(text()).not.toContain('Reintentar');
  });

  it('shows the backend error and retries with the active filters', async () => {
    api.getReports.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { status: 500, message: 'Fallo al leer los reportes' }
      }))
    );
    await create();

    expect(text()).toContain('Fallo al leer los reportes');
    expect(text()).not.toContain('No hay reportes');

    component.statusFilter = 'solucionado';
    const retry: HTMLButtonElement = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find(button => button.textContent?.includes('Reintentar'))!;
    retry.click();
    fixture.detectChanges();

    expect(api.getFilteredReports).toHaveBeenCalledWith(
      'solucionado',
      undefined,
      undefined,
      undefined,
      'incidente'
    );
    expect(text()).toContain('Robo');
  });

  it('requires the resolution fields for a solved report and does not call the api', async () => {
    await create();

    fillBase();
    component.newReport.status = 'solucionado';
    component.createReport();
    fixture.detectChanges();

    expect(api.createReport).not.toHaveBeenCalled();
    const modal = fixture.nativeElement.querySelector('.modal').textContent;
    expect(modal).toContain('Falta la fecha de resolución.');
    expect(modal).toContain('Falta la descripción de la resolución.');
  });

  it('lists every missing field when the form is empty', async () => {
    await create();

    component.openModal();
    component.createReport();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.modal').textContent;
    expect(api.createReport).not.toHaveBeenCalled();
    expect(modal).toContain('Falta el título.');
    expect(modal).toContain('Falta la descripción.');
    expect(modal).toContain('Falta la fecha del incidente.');
  });

  it('shows the resolution fields only for the solved status', async () => {
    await create();
    component.openModal();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#newResolvedAt')).toBeNull();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#status');
    select.value = 'solucionado';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#newResolvedAt')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#newResolutionDescription')).not.toBeNull();
  });

  it('creates a valid report and reloads the list with the active filters', async () => {
    await create();

    component.statusFilter = 'investigacion';
    fillBase();
    component.createReport();
    await fixture.whenStable();

    expect(api.createReport).toHaveBeenCalledTimes(1);
    expect(component.showModal()).toBe(false);
    expect(api.getFilteredReports).toHaveBeenCalledWith(
      'investigacion',
      undefined,
      undefined,
      undefined,
      'incidente'
    );
  });

  it('sends the resolution data for a valid solved report', async () => {
    await create();

    fillBase();
    component.newReport.status = 'solucionado';
    component.newReport.resolvedAt = '2026-01-02T10:00';
    component.newReport.resolutionDescription = 'Resuelto';
    component.createReport();

    expect(api.createReport.mock.calls[0][0]).toMatchObject({
      status: 'solucionado',
      resolvedAt: '2026-01-02T10:00',
      resolutionDescription: 'Resuelto'
    });
  });

  it('shows the backend message on a 400 and keeps the modal open', async () => {
    api.createReport.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { status: 400, message: 'La fecha de resolución es obligatoria' }
      }))
    );
    await create();

    fillBase();
    component.createReport();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.showModal()).toBe(true);
    expect(component.saving()).toBe(false);
    expect(fixture.nativeElement.querySelector('.modal').textContent)
      .toContain('La fecha de resolución es obligatoria');
  });

  it('ends the session and goes to the guard selection when the guard no longer exists', async () => {
    api.createReport.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { status: 400, message: 'El vigilante no existe' }
      }))
    );
    await create();
    const session = TestBed.inject(SessionService);
    session.setActiveGuard({ id: 'g-borrado', name: 'Marta' });

    fillBase();
    component.createReport();
    await fixture.whenStable();

    expect(session.getActiveGuard()).toBeNull();
    expect(session.notice()).toContain('Selecciona de nuevo el vigilante');
    expect(navigateByUrl).toHaveBeenCalledWith('/guards');
    expect(component.saving()).toBe(false);
  });

  it('sends a single create request on a double click', async () => {
    const pending = new Subject<unknown>();
    api.createReport.mockReturnValue(pending);
    await create();

    fillBase();
    component.createReport();
    component.createReport();

    expect(api.createReport).toHaveBeenCalledTimes(1);
  });

  it('closes the create modal with Escape and labels the dialog', async () => {
    await create();

    component.openModal();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.modal');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.querySelector('.close-button').getAttribute('aria-label')).toBe('Cerrar');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.showModal()).toBe(false);
    expect(fixture.nativeElement.querySelector('.modal')).toBeNull();
  });

  const SOLVED = {
    ...REPORT,
    status: 'solucionado',
    resolvedAt: '2026-01-03T10:00:00',
    resolutionDescription: 'Resuelto'
  };

  function changeStatus(value: string): HTMLSelectElement {
    const select: HTMLSelectElement =
      fixture.nativeElement.querySelector('#status-r1');
    select.value = value;
    select.dispatchEvent(new Event('change'));
    return select;
  }

  async function openResolution(): Promise<void> {
    await create();
    changeStatus('solucionado');
    await fixture.whenStable();
  }

  function resolutionModal(): HTMLElement {
    return fixture.nativeElement.querySelector('[aria-labelledby="resolve-report-title"]');
  }

  it('sends one status request on a double change and disables the select meanwhile', async () => {
    const pending = new Subject<unknown>();
    api.getReports.mockReturnValue(of([SOLVED]));
    api.updateReportStatus.mockReturnValue(pending);
    await create();

    changeStatus('investigacion');
    changeStatus('investigacion');
    await fixture.whenStable();

    expect(api.updateReportStatus).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('#status-r1').disabled).toBe(true);

    pending.next({ ...REPORT });
    await fixture.whenStable();

    expect(component.statusSaving()).toBe(false);
    expect(fixture.nativeElement.querySelector('#status-r1').disabled).toBe(false);
  });

  it('shows the backend message when the status cannot be changed', async () => {
    api.getReports.mockReturnValue(of([SOLVED]));
    api.updateReportStatus.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 404,
        error: { status: 404, message: 'Reporte no encontrado' }
      }))
    );
    await create();

    const select = changeStatus('investigacion');
    await fixture.whenStable();

    expect(text()).toContain('Reporte no encontrado');
    expect(select.value).toBe('solucionado');
    expect(component.statusSaving()).toBe(false);
  });

  it('lists the missing resolution fields inside the modal without calling the api', async () => {
    await openResolution();

    component.confirmResolution();
    await fixture.whenStable();

    expect(api.updateReportStatus).not.toHaveBeenCalled();
    expect(resolutionModal().textContent).toContain('Falta la fecha de resolución.');
    expect(resolutionModal().textContent).toContain('Falta la descripción de la resolución.');
  });

  it('shows the backend message inside the resolution modal and keeps it open', async () => {
    api.updateReportStatus.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { status: 400, message: 'Un reporte solucionado necesita fecha de solución' }
      }))
    );
    await openResolution();

    component.resolutionData.resolvedAt = '2026-01-03T10:00';
    component.resolutionData.resolutionDescription = 'Resuelto';
    component.confirmResolution();
    await fixture.whenStable();

    expect(component.resolutionModal()).toBe(true);
    expect(resolutionModal().textContent)
      .toContain('Un reporte solucionado necesita fecha de solución');
    expect(resolutionModal().querySelector<HTMLButtonElement>('.confirm-button')?.disabled)
      .toBe(false);
  });

  it('sends one resolution request on a double click and disables the button meanwhile', async () => {
    const pending = new Subject<unknown>();
    api.updateReportStatus.mockReturnValue(pending);
    await openResolution();

    component.resolutionData.resolvedAt = '2026-01-03T10:00';
    component.resolutionData.resolutionDescription = 'Resuelto';
    component.confirmResolution();
    component.confirmResolution();
    await fixture.whenStable();

    expect(api.updateReportStatus).toHaveBeenCalledTimes(1);
    expect(resolutionModal().querySelector<HTMLButtonElement>('.confirm-button')?.disabled)
      .toBe(true);

    pending.next(SOLVED);
    await fixture.whenStable();

    expect(component.resolutionModal()).toBe(false);
    expect(component.statusSaving()).toBe(false);
  });

  it('shows the appearances load error inside the face picker', async () => {
    api.getFaceAppearances.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { status: 500, message: 'Fallo al listar las detecciones' }
      }))
    );
    await create();

    component.openModal();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.people-section').textContent)
      .toContain('Fallo al listar las detecciones');
  });

  it('opens the create modal with the detection from the query param and clears the param', async () => {
    queryParams = { faceId: 'job-1_4' };
    api.getFaceAppearances.mockReturnValue(of([
      { faceId: 'job-1_4', timestamp: '00:00:01', cameraId: 'CAM-01', frameUrl: 'https://x/4.jpg' }
    ]));
    await create();

    expect(component.showModal()).toBe(true);
    expect(component.newReport.faceIds).toEqual(['job-1_4']);
    const selected = fixture.nativeElement.querySelector('.person-option.selected');
    expect(selected?.getAttribute('aria-label')).toBe('Detección job-1_4');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { faceId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      })
    );
  });

  it('does not open the create modal without the query param', async () => {
    await create();

    expect(component.showModal()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the detail route from a report card', async () => {
    await create();

    const button = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('.item button')
    ).find(candidate => candidate.textContent?.trim() === 'Ver detalle');

    button!.click();

    expect(navigate).toHaveBeenCalledWith(['/reports', 'r1']);
  });

  it('sends the active guard id when creating a report', async () => {
    await create();
    TestBed.inject(SessionService).setActiveGuard({ id: 'g1', name: 'Marta' });

    fillBase();
    component.createReport();

    expect(api.createReport.mock.calls[0][0].createdByGuardId).toBe('g1');
  });

  it('refetches the appearances after ten minutes keeping the current ones, and stops on destroy', async () => {
    vi.useFakeTimers();
    api.getFaceAppearances.mockReturnValue(of([
      { faceId: 'job-1_1', timestamp: '00:00:01', cameraId: 'CAM-01', frameUrl: 'https://x/1.jpg' }
    ]));
    await create();
    expect(api.getFaceAppearances).toHaveBeenCalledTimes(1);

    const pending = new Subject<unknown[]>();
    api.getFaceAppearances.mockReturnValue(pending);

    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    expect(api.getFaceAppearances).toHaveBeenCalledTimes(2);
    expect(component.appearances().length).toBe(1);

    pending.next([]);
    pending.complete();
    expect(component.appearances().length).toBe(0);

    fixture.destroy();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(api.getFaceAppearances).toHaveBeenCalledTimes(2);
  });

  it('keeps the current appearances when a refresh fails', async () => {
    vi.useFakeTimers();
    api.getFaceAppearances.mockReturnValue(of([
      { faceId: 'job-1_1', timestamp: '00:00:01', cameraId: 'CAM-01', frameUrl: 'https://x/1.jpg' }
    ]));
    await create();

    api.getFaceAppearances.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

    expect(component.appearances().length).toBe(1);
    expect(component.appearancesError()).toBe('');
  });
});
