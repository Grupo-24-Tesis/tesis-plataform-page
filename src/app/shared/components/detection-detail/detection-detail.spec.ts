import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { FaceAppearance } from '../../../core/models/face.model';
import { MarksService } from '../../services/marks.service';
import { DetectionDetailComponent } from './detection-detail';

const APPEARANCE: FaceAppearance = {
  faceId: 'job-1_4',
  jobId: 'job-1',
  timestamp: '00:01:23',
  cameraId: 'CAM-01',
  frameUrl: 'https://x/4.jpg',
  capturedAt: '2026-10-16T10:05:21'
};

const CAMERAS = [{ id: 'CAM-01', name: 'Entrada', active: true }];

describe('DetectionDetailComponent', () => {
  let fixture: ComponentFixture<DetectionDetailComponent>;
  let api: {
    getVideoJob: ReturnType<typeof vi.fn>;
    getMarked: ReturnType<typeof vi.fn>;
    createMarked: ReturnType<typeof vi.fn>;
    deleteMarked: ReturnType<typeof vi.fn>;
    getDetectionMatches: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;

  async function create(appearance: FaceAppearance = APPEARANCE): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DetectionDetailComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: { navigate } }
      ]
    }).compileComponents();

    TestBed.inject(MarksService).load();
    fixture = TestBed.createComponent(DetectionDetailComponent);
    fixture.componentRef.setInput('appearance', appearance);
    fixture.componentRef.setInput('cameras', CAMERAS);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function query(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  function markButton(): HTMLButtonElement {
    return query('.mark-button') as HTMLButtonElement;
  }

  beforeEach(() => {
    navigate = vi.fn(() => Promise.resolve(true));
    api = {
      getVideoJob: vi.fn(() => of({ jobId: 'job-1', originalFileName: 'Camera_ch6.mp4' })),
      getMarked: vi.fn(() => of([])),
      getDetectionMatches: vi.fn(() => of({ faceId: '', links: [], detections: [] })),
      createMarked: vi.fn(),
      deleteMarked: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('renders camera, date, video, position and image', async () => {
    await create();

    expect(query('.fact-camera').textContent).toContain('Entrada');
    expect(query('.fact-date').textContent).toContain('2026-10-16 10:05:21');
    expect(query('.fact-video').textContent).toContain('Camera_ch6.mp4');
    expect(query('.fact-position').textContent).toContain('00:01:23');
    expect(query('img').getAttribute('src')).toBe('https://x/4.jpg');
    expect(api.getVideoJob).toHaveBeenCalledWith('job-1');
  });

  it('derives the job from the face id when the jobId is missing', async () => {
    await create({ ...APPEARANCE, jobId: undefined, faceId: 'job-7_12' });

    expect(api.getVideoJob).toHaveBeenCalledWith('job-7');
  });

  it('falls back to the camera id when the camera is unknown', async () => {
    await create({ ...APPEARANCE, cameraId: 'CAM-99' });

    expect(query('.fact-camera').textContent).toContain('CAM-99');
  });

  it('shows an error and retries when the video cannot be loaded', async () => {
    api.getVideoJob.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    await create();

    expect(query('.fact-video').textContent).toContain('No se pudo cargar el video');

    (query('.link-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(query('.fact-video').textContent).toContain('Camera_ch6.mp4');
  });

  it('marks with the typed reason and then offers to remove the mark', async () => {
    api.createMarked.mockReturnValue(of({ id: 'm1', faceId: 'job-1_4', reason: 'Merodeo' }));
    await create();

    const input = query('.mark-reason') as HTMLInputElement;
    input.value = 'Merodeo';
    input.dispatchEvent(new Event('input'));
    markButton().click();
    await fixture.whenStable();

    expect(api.createMarked).toHaveBeenCalledWith({ faceId: 'job-1_4', reason: 'Merodeo' });
    expect(markButton().textContent).toContain('Quitar marca');
  });

  it('marks with Sin motivo when no reason is typed', async () => {
    api.createMarked.mockReturnValue(of({ id: 'm1', faceId: 'job-1_4', reason: 'Sin motivo' }));
    await create();

    markButton().click();
    await fixture.whenStable();

    expect(api.createMarked).toHaveBeenCalledWith({ faceId: 'job-1_4', reason: 'Sin motivo' });
  });

  it('removes an existing mark', async () => {
    api.getMarked.mockReturnValue(of([{ id: 'm1', faceId: 'job-1_4', reason: 'x' }]));
    api.deleteMarked.mockReturnValue(of(undefined));
    await create();

    expect(markButton().textContent).toContain('Quitar marca');

    markButton().click();
    await fixture.whenStable();

    expect(api.deleteMarked).toHaveBeenCalledWith('m1');
    expect(markButton().textContent).toContain('Marcar');
  });

  it('shows the backend message and reloads marks on a 409', async () => {
    api.getMarked
      .mockReturnValueOnce(of([]))
      .mockReturnValue(of([{ id: 'm9', faceId: 'job-1_4', reason: 'otro' }]));
    api.createMarked.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { status: 409, message: 'La detección ya está marcada' }
      }))
    );
    await create();

    markButton().click();
    await fixture.whenStable();

    expect(api.getMarked).toHaveBeenCalledTimes(2);
    expect(markButton().textContent).toContain('Quitar marca');
    expect(query('.mark-message').textContent).toContain('La detección ya está marcada');
  });

  it('ignores a second click while a mark request is pending', async () => {
    const pending = new Subject<unknown>();
    api.createMarked.mockReturnValue(pending);
    await create();

    markButton().click();
    await fixture.whenStable();
    markButton().click();

    expect(api.createMarked).toHaveBeenCalledTimes(1);
    expect(markButton().disabled).toBe(true);
    expect(markButton().textContent).toContain('Guardando...');
  });

  it('opens the report form with the detection in the query param', async () => {
    await create();

    (query('.report-button') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/reports'], { queryParams: { faceId: 'job-1_4' } });
  });

  it('ignores a stale video response after switching to another detection', async () => {
    const slow = new Subject<unknown>();
    api.getVideoJob.mockImplementation((jobId: string) =>
      jobId === 'job-1' ? slow : of({ jobId, originalFileName: 'Otro.mp4' })
    );
    await create();

    fixture.componentRef.setInput('appearance', { ...APPEARANCE, faceId: 'job-2_1', jobId: 'job-2' });
    fixture.detectChanges();
    await fixture.whenStable();
    slow.next({ jobId: 'job-1', originalFileName: 'Camera_ch6.mp4' });
    fixture.detectChanges();

    expect(query('.fact-video').textContent).toContain('Otro.mp4');
  });

  it('does not refetch a video name it already has', async () => {
    await create();

    fixture.componentRef.setInput('appearance', { ...APPEARANCE, faceId: 'job-2_1', jobId: 'job-2' });
    fixture.detectChanges();
    fixture.componentRef.setInput('appearance', APPEARANCE);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getVideoJob).toHaveBeenCalledTimes(2);
  });

  it('does not load the marks by itself', async () => {
    await create();

    expect(api.getMarked).toHaveBeenCalledTimes(1);
  });

  it('re-emits openDetection', async () => {
    api.getDetectionMatches.mockReturnValue(
      of({
        faceId: 'job-1_4',
        links: [],
        detections: [
          { faceId: 'job-2_7', jobId: 'job-2', cameraId: 'CAM-02', cameraName: 'Garaje', videoName: 'g.mp4', timestamp: '00:00:01', score: null }
        ]
      })
    );
    await create();
    const opened: string[] = [];
    fixture.componentInstance.openDetection.subscribe(id => opened.push(id));

    query('app-detection-matches .match-face').click();

    expect(opened).toEqual(['job-2_7']);
  });
});
