import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { ReportMatchesComponent } from './report-matches';

const MATCHES = {
  faceId: 'job-1_1',
  links: [{ id: 'l1', faceIdA: 'job-1_1', faceIdB: 'job-2_4' }],
  detections: [
    { faceId: 'job-2_4', jobId: 'job-2', cameraId: 'CAM-02', cameraName: 'Garaje', videoName: 'garaje.mp4', timestamp: '00:00:07', capturedAt: '2026-01-02T10:00:00', score: 0.8, frameUrl: 'https://x/4.jpg' },
    { faceId: 'job-1_1', jobId: 'job-1', cameraId: 'CAM-01', cameraName: 'Entrada', videoName: 'entrada.mp4', timestamp: '00:01:00', capturedAt: '2026-01-01T10:00:00', score: null },
    { faceId: 'job-3_2', jobId: 'job-3', cameraId: 'CAM-03', cameraName: 'Patio', videoName: 'patio.mp4', timestamp: '00:00:02', capturedAt: '2026-01-01T09:00:00', score: 0.7 }
  ]
};

describe('ReportMatchesComponent', () => {
  let fixture: ComponentFixture<ReportMatchesComponent>;
  let api: { getDetectionMatches: ReturnType<typeof vi.fn> };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ReportMatchesComponent],
      providers: [{ provide: ApiService, useValue: api }]
    }).compileComponents();
    fixture = TestBed.createComponent(ReportMatchesComponent);
    fixture.componentRef.setInput('faceId', 'job-1_1');
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  beforeEach(() => {
    api = { getDetectionMatches: vi.fn(() => of(MATCHES)) };
  });

  it('lists confirmed matches read-only', async () => {
    await create();

    expect(api.getDetectionMatches).toHaveBeenCalledWith('job-1_1');
    expect(text()).toContain('Coincidencias confirmadas');
    const items: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('li'));
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Patio');
    expect(items[0].textContent).toContain('patio.mp4');
    expect(items[0].textContent).toContain('00:00:02');
    expect(items[1].textContent).toContain('Garaje');
    expect(items[1].querySelector('img')?.getAttribute('src')).toBe('https://x/4.jpg');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('shows empty text', async () => {
    api.getDetectionMatches.mockReturnValue(of({ faceId: 'job-1_1', links: [], detections: [] }));
    await create();

    expect(text()).toContain('Sin coincidencias confirmadas');
  });

  it('shows error with Reintentar', async () => {
    api.getDetectionMatches.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Fallo del servidor' } }))
    );
    await create();

    expect(text()).toContain('Fallo del servidor');
    api.getDetectionMatches.mockReturnValue(of(MATCHES));
    const retry: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(retry.textContent?.trim()).toBe('Reintentar');
    retry.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(2);
  });
});
