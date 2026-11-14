import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { UniqueFace } from '../../core/models/UniqueFace';
import { MarksService } from '../../shared/services/marks.service';
import { UniqueFaces } from './unique-faces';

const FACE = {
  faceId: 'job-1_1',
  suspect: false,
  reportCount: 0,
  appearances: [
    { cameraId: 'CAM-01', timestamp: '00:00:01', capturedAt: '2026-01-01T10:00:00', frameUrl: 'https://x/1.jpg' }
  ]
};

describe('UniqueFaces', () => {
  let fixture: ComponentFixture<UniqueFaces>;
  let component: UniqueFaces;
  let api: {
    getUniqueFaces: ReturnType<typeof vi.fn>;
    getCameras: ReturnType<typeof vi.fn>;
    getVideoJob: ReturnType<typeof vi.fn>;
    getMarked: ReturnType<typeof vi.fn>;
    createMarked: ReturnType<typeof vi.fn>;
    deleteMarked: ReturnType<typeof vi.fn>;
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [UniqueFaces],
      providers: [{ provide: ApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(UniqueFaces);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  beforeEach(() => {
    api = {
      getUniqueFaces: vi.fn(() => of([FACE])),
      getCameras: vi.fn(() => of([{ id: 'CAM-01', name: 'Entrada', active: true }])),
      getVideoJob: vi.fn(() => of({ jobId: 'job-1', originalFileName: 'Camera_ch6.mp4' })),
      getMarked: vi.fn(() => of([])),
      createMarked: vi.fn(),
      deleteMarked: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('shows the loading state and then the results', async () => {
    const pending = new Subject<unknown[]>();
    api.getUniqueFaces.mockReturnValue(pending);
    await create();

    expect(text()).toContain('Cargando...');

    pending.next([FACE]);
    pending.complete();
    fixture.detectChanges();

    expect(text()).not.toContain('Cargando...');
    expect(fixture.nativeElement.querySelectorAll('.card').length).toBe(1);
    expect(text()).toContain('Rostros detectados');
    expect(text()).toMatch(/1\s+detección/);
    expect(text()).not.toContain('apariciones');
    expect(text()).toContain('SIN MARCAR');
  });

  it('shows the empty state when there are no results', async () => {
    api.getUniqueFaces.mockReturnValue(of([]));
    await create();

    expect(text()).toContain('No hay resultados que coincidan con los filtros');
    expect(text()).not.toContain('Reintentar');
  });

  it('shows the backend message and retries on demand', async () => {
    api.getUniqueFaces.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { status: 400, message: 'Fecha inválida' }
      }))
    );
    await create();

    expect(text()).toContain('Fecha inválida');
    expect(text()).not.toContain('No hay resultados que coincidan');

    const retry: HTMLButtonElement = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find(button => button.textContent?.includes('Reintentar'))!;
    retry.click();
    fixture.detectChanges();

    expect(api.getUniqueFaces).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('Fecha inválida');
    expect(fixture.nativeElement.querySelectorAll('.card').length).toBe(1);
  });

  it('sends only the start date when only it is filled', async () => {
    await create();

    component.startDate = '2026-01-01';
    component.applyFilters();

    expect(api.getUniqueFaces).toHaveBeenLastCalledWith(
      '2026-01-01',
      undefined,
      undefined,
      undefined
    );
  });

  it('sends only the end date when only it is filled', async () => {
    await create();

    component.endDate = '2026-02-01';
    component.applyFilters();

    expect(api.getUniqueFaces).toHaveBeenLastCalledWith(
      undefined,
      '2026-02-01',
      undefined,
      undefined
    );
  });

  it('shows the camera load error and still renders the cards', async () => {
    api.getCameras.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { status: 500, message: 'Fallo al listar las cámaras' }
      }))
    );
    await create();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.cameras-error').textContent)
      .toContain('Fallo al listar las cámaras');
    expect(fixture.nativeElement.querySelectorAll('.card').length).toBe(1);
    expect(component.getCameraName('CAM-01')).toBe('Cámara no identificada');
  });

  it('shows the shared detection detail when a card is selected', async () => {
    await create();

    component.selectFace(FACE as UniqueFace);
    fixture.detectChanges();
    await fixture.whenStable();

    const detail: HTMLElement = fixture.nativeElement.querySelector('.detail app-detection-detail');
    expect(detail.querySelector('.fact-camera')?.textContent).toContain('Entrada');
    expect(detail.querySelector('.fact-video')?.textContent).toContain('Camera_ch6.mp4');
    expect(api.getVideoJob).toHaveBeenCalledWith('job-1');
  });

  async function openDetail(): Promise<void> {
    await create();
    component.selectFace(FACE as UniqueFace);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function badge(): string {
    return fixture.nativeElement.querySelector('.status-badge').textContent.trim();
  }

  function markButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.mark-button');
  }

  it('shows MARCADO after a 409 because the mark exists', async () => {
    api.getMarked
      .mockReturnValueOnce(of([]))
      .mockReturnValue(of([{ id: 'm9', faceId: 'job-1_1', reason: 'otro' }]));
    api.createMarked.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { status: 409, message: 'La detección ya está marcada' }
      }))
    );
    await openDetail();

    markButton().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(badge()).toBe('MARCADO');
  });

  it('updates the badge when the panel closes while the mark is pending', async () => {
    const pending = new Subject<unknown>();
    api.createMarked.mockReturnValue(pending);
    await openDetail();

    markButton().click();
    component.selected.set(null);
    fixture.detectChanges();
    pending.next({ id: 'm1', faceId: 'job-1_1', reason: 'Sin motivo' });
    pending.complete();
    fixture.detectChanges();

    expect(badge()).toBe('MARCADO');
  });

  it('reflects a mark removed elsewhere when the detail is opened', async () => {
    api.getMarked.mockReturnValue(of([{ id: 'm1', faceId: 'job-1_1', reason: 'x' }]));
    api.deleteMarked.mockReturnValue(of(undefined));
    await create();
    expect(badge()).toBe('MARCADO');

    TestBed.inject(MarksService).remove('m1').subscribe();
    component.selectFace(FACE as UniqueFace);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(badge()).toBe('SIN MARCAR');
    expect(markButton().textContent).toContain('Marcar');
  });

  describe('url refresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reloads faces older than ten minutes and keeps the cards meanwhile', async () => {
      const pending = new Subject<unknown[]>();
      await create();
      api.getUniqueFaces.mockReturnValue(pending);

      vi.advanceTimersByTime(9 * 60 * 1000);
      expect(api.getUniqueFaces).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(api.getUniqueFaces).toHaveBeenCalledTimes(2);
      expect(component.faces().length).toBe(1);
      expect(component.loading()).toBe(false);

      pending.next([FACE, { ...FACE, faceId: 'job-1_2' }]);
      pending.complete();
      expect(component.faces().length).toBe(2);
    });

    it('ignores a refresh response that arrives after a newer filter load', async () => {
      const slow = new Subject<unknown[]>();
      await create();
      api.getUniqueFaces.mockReturnValue(slow);
      vi.advanceTimersByTime(11 * 60 * 1000);

      api.getUniqueFaces.mockReturnValue(of([]));
      component.applyFilters();
      slow.next([FACE]);

      expect(component.faces().length).toBe(0);
    });

    it('keeps the cards when a silent refresh fails', async () => {
      await create();
      api.getUniqueFaces.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );

      vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

      expect(api.getUniqueFaces).toHaveBeenCalledTimes(2);
      expect(component.faces().length).toBe(1);
      expect(component.loadError()).toBe('');
    });

    it('stops checking after destroy', async () => {
      await create();
      component.ngOnDestroy();

      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(api.getUniqueFaces).toHaveBeenCalledTimes(1);
    });
  });
});

