import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
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

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [{ provide: ApiService, useValue: api }]
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

  it('sends a single create request on a double click', async () => {
    const pending = new Subject<unknown>();
    api.createReport.mockReturnValue(pending);
    await create();

    fillBase();
    component.createReport();
    component.createReport();

    expect(api.createReport).toHaveBeenCalledTimes(1);
  });
});
