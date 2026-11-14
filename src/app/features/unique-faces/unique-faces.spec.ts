import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
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
      getCameras: vi.fn(() => of([]))
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
        error: { status: 400, message: 'Fecha invalida' }
      }))
    );
    await create();

    expect(text()).toContain('Fecha invalida');
    expect(text()).not.toContain('No hay resultados que coincidan');

    const retry: HTMLButtonElement = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find(button => button.textContent?.includes('Reintentar'))!;
    retry.click();
    fixture.detectChanges();

    expect(api.getUniqueFaces).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('Fecha invalida');
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
});
