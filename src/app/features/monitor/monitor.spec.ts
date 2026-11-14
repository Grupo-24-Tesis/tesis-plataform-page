import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { VideoJobResponse } from '../../core/models/uploadVideo';
import { MonitorComponent } from './monitor';

function job(
  status: string,
  failureReason: string | null = null,
  jobId = 'job-1'
): VideoJobResponse {
  return {
    jobId,
    originalFileName: 'Camera_ch6.mp4',
    bucket: 'cubo',
    objectKey: 'videos/abc.mp4',
    cameraId: 'CAM-01',
    status,
    createdAt: '2026-11-14T12:00:00Z',
    updatedAt: '2026-11-14T12:01:00Z',
    failureReason
  };
}

const FACE = {
  id: 'a',
  faceId: 'job-1_4',
  timestamp: '00:01:23',
  cameraId: 'CAM-01',
  frameUrl: 'https://cubo.s3.us-east-2.amazonaws.com/faces/job-1/4.jpg?firma',
  capturedAt: '2026-10-16T10:05:21'
};

describe('MonitorComponent', () => {
  let fixture: ComponentFixture<MonitorComponent>;
  let component: MonitorComponent;
  let api: {
    getCameras: ReturnType<typeof vi.fn>;
    getVideoJobs: ReturnType<typeof vi.fn>;
    getVideoJobFaces: ReturnType<typeof vi.fn>;
    requestVideoUploadUrl: ReturnType<typeof vi.fn>;
    uploadVideoToS3: ReturnType<typeof vi.fn>;
    notifyVideoUploaded: ReturnType<typeof vi.fn>;
    getMarked: ReturnType<typeof vi.fn>;
    createMarked: ReturnType<typeof vi.fn>;
    deleteMarked: ReturnType<typeof vi.fn>;
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MonitorComponent],
      providers: [{ provide: ApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(MonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    api = {
      getCameras: vi.fn(() =>
        of([
          { id: 'CAM-01', name: 'Entrada', active: true },
          { id: 'CAM-02', name: 'Garaje', active: true }
        ])
      ),
      getVideoJobs: vi.fn(() => of([job('QUEUED')])),
      getVideoJobFaces: vi.fn(() => of([])),
      requestVideoUploadUrl: vi.fn(),
      uploadVideoToS3: vi.fn(),
      notifyVideoUploaded: vi.fn(),
      getMarked: vi.fn(() => of([])),
      createMarked: vi.fn(),
      deleteMarked: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads the jobs of the selected camera and shows the video count', async () => {
    await create();

    expect(api.getVideoJobs).toHaveBeenCalledWith('CAM-01');
    expect(component.videos().length).toBe(1);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Camera_ch6.mp4');
    expect(text).toContain('En cola');
    expect(text).toContain('1 video');
    expect(text).not.toContain('apariciones totales');
  });

  it('shows the failure reason of a failed job', async () => {
    api.getVideoJobs.mockReturnValue(of([job('FAILED', 'video no encontrado')]));

    await create();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fallido');
    expect(text).toContain('video no encontrado');
    expect(api.getVideoJobFaces).not.toHaveBeenCalled();
  });

  it('renders the faces of a completed job as images', async () => {
    api.getVideoJobs.mockReturnValue(of([job('COMPLETED')]));
    api.getVideoJobFaces.mockReturnValue(of([FACE]));

    await create();

    expect(api.getVideoJobFaces).toHaveBeenCalledWith('job-1');
    const img: HTMLImageElement | null =
      fixture.nativeElement.querySelector('.face-preview img');
    expect(img?.getAttribute('src')).toBe(FACE.frameUrl);
    expect(fixture.nativeElement.textContent).toContain('Entrada');
    expect(fixture.nativeElement.textContent).not.toContain('CAM-01');
  });

  it('shows the empty text for a completed job without faces', async () => {
    api.getVideoJobs.mockReturnValue(of([job('COMPLETED')]));

    await create();

    expect(fixture.nativeElement.textContent)
      .toContain('Sin rostros detectados en este video');
  });

  it('shows the backend error when the list cannot be loaded', async () => {
    api.getVideoJobs.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { status: 500, message: 'Fallo interno' }
      }))
    );

    await create();

    expect(fixture.nativeElement.textContent).toContain('Fallo interno');
  });

  it('loads the faces when a failed job completes on a later refresh', async () => {
    vi.useFakeTimers();
    api.getVideoJobs
      .mockReturnValueOnce(of([job('FAILED', 'tiempo agotado')]))
      .mockReturnValue(of([job('COMPLETED')]));
    api.getVideoJobFaces.mockReturnValue(of([FACE]));

    await create();
    expect(api.getVideoJobFaces).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30000);
    await fixture.whenStable();

    expect(api.getVideoJobs).toHaveBeenCalledTimes(2);
    expect(api.getVideoJobFaces).toHaveBeenCalledWith('job-1');
    expect(fixture.nativeElement.querySelector('.face-preview img')).not.toBeNull();
  });

  it('refreshes every 5 seconds while a job is active', async () => {
    vi.useFakeTimers();

    await create();
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);

    expect(api.getVideoJobs).toHaveBeenCalledTimes(3);
  });

  it('retries the faces of a job on the next refresh when they fail to load', async () => {
    vi.useFakeTimers();
    api.getVideoJobs.mockReturnValue(of([job('COMPLETED')]));
    api.getVideoJobFaces
      .mockReturnValueOnce(throwError(() => new Error('sin backend')))
      .mockReturnValue(of([FACE]));

    await create();
    expect(fixture.nativeElement.querySelector('.face-preview img')).toBeNull();

    vi.advanceTimersByTime(30000);
    await fixture.whenStable();

    expect(api.getVideoJobFaces).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.face-preview img')).not.toBeNull();
  });

  it('refetches the faces once their urls are older than ten minutes', async () => {
    vi.useFakeTimers();
    const freshFace = { ...FACE, frameUrl: 'https://cubo.s3.amazonaws.com/nueva?firma' };
    api.getVideoJobs.mockReturnValue(of([job('COMPLETED')]));
    api.getVideoJobFaces
      .mockReturnValueOnce(of([FACE]))
      .mockReturnValue(of([freshFace]));

    await create();
    vi.advanceTimersByTime(9 * 60 * 1000);
    await fixture.whenStable();
    expect(api.getVideoJobFaces).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(90 * 1000);
    await fixture.whenStable();

    expect(api.getVideoJobFaces).toHaveBeenCalledTimes(2);
    const img: HTMLImageElement | null =
      fixture.nativeElement.querySelector('.face-preview img');
    expect(img?.getAttribute('src')).toBe(freshFace.frameUrl);
  });

  it('keeps the old cards while the refetched faces are pending', async () => {
    vi.useFakeTimers();
    const pending = new Subject<unknown[]>();
    api.getVideoJobs.mockReturnValue(of([job('COMPLETED')]));
    api.getVideoJobFaces
      .mockReturnValueOnce(of([FACE]))
      .mockReturnValue(pending);

    await create();
    vi.advanceTimersByTime(10 * 60 * 1000);
    await fixture.whenStable();

    expect(api.getVideoJobFaces).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.face-preview img')).not.toBeNull();
  });

  it('uses the idle interval when every job is terminal', async () => {
    vi.useFakeTimers();
    api.getVideoJobs.mockReturnValue(of([job('COMPLETED')]));

    await create();
    vi.advanceTimersByTime(5000);
    expect(api.getVideoJobs).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(25000);
    expect(api.getVideoJobs).toHaveBeenCalledTimes(2);
  });

  it('ignores a slow list response of a camera that is no longer selected', async () => {
    const slowA = new Subject<VideoJobResponse[]>();
    api.getVideoJobs
      .mockReturnValueOnce(slowA)
      .mockReturnValue(of([job('QUEUED', null, 'job-b')]));

    await create();
    component.selectCamera({ id: 'CAM-02', name: 'Garaje', active: true });
    slowA.next([job('QUEUED', null, 'job-a')]);
    await fixture.whenStable();

    expect(component.videos().map(video => video.jobId)).toEqual(['job-b']);
    expect(component.cameraVideoCountLabel('CAM-01')).toBe('');
  });

  it('ignores the response of the first visit when the same camera is selected again', async () => {
    const firstA = new Subject<VideoJobResponse[]>();
    const secondA = new Subject<VideoJobResponse[]>();
    api.getVideoJobs
      .mockReturnValueOnce(firstA)
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(secondA);

    await create();
    component.selectCamera({ id: 'CAM-02', name: 'Garaje', active: true });
    component.selectCamera({ id: 'CAM-01', name: 'Entrada', active: true });
    firstA.next([job('QUEUED', null, 'job-viejo')]);
    expect(component.videos()).toEqual([]);

    secondA.next([job('QUEUED', null, 'job-nuevo')]);
    expect(component.videos().map(video => video.jobId)).toEqual(['job-nuevo']);
  });

  it('does not schedule another refresh from a stale response', async () => {
    vi.useFakeTimers();
    const slowA = new Subject<VideoJobResponse[]>();
    api.getVideoJobs
      .mockReturnValueOnce(slowA)
      .mockReturnValue(of([job('COMPLETED', null, 'job-b')]));

    await create();
    component.selectCamera({ id: 'CAM-02', name: 'Garaje', active: true });
    slowA.next([job('QUEUED', null, 'job-a')]);
    vi.advanceTimersByTime(30000);

    expect(api.getVideoJobs).toHaveBeenCalledTimes(3);
  });

  it('reloads the list when the camera changes', async () => {
    await create();

    component.selectCamera({ id: 'CAM-02', name: 'Garaje', active: true });
    await fixture.whenStable();

    expect(api.getVideoJobs).toHaveBeenLastCalledWith('CAM-02');
    expect(component.cameraVideoCountLabel('CAM-02')).toBe('1 video');
    expect(component.cameraVideoCountLabel('CAM-01')).toBe('1 video');
  });

  it('stops refreshing when destroyed', async () => {
    vi.useFakeTimers();

    await create();
    component.ngOnDestroy();
    vi.advanceTimersByTime(60000);

    expect(api.getVideoJobs).toHaveBeenCalledTimes(1);
  });

  async function openDetail(): Promise<void> {
    api.getVideoJobs.mockReturnValue(of([job('COMPLETED')]));
    api.getVideoJobFaces.mockReturnValue(of([FACE]));
    await create();
    component.selectCluster(component.videos()[0], component.videos()[0].clusters[0]);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function markButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.detail-actions button');
  }

  it('marks the detection with the typed reason', async () => {
    api.createMarked.mockReturnValue(of({ id: 'm1', faceId: 'job-1_4', reason: 'Merodeo' }));
    await openDetail();

    component.markReason.set('Merodeo');
    markButton().click();
    await fixture.whenStable();

    expect(api.createMarked).toHaveBeenCalledWith({ faceId: 'job-1_4', reason: 'Merodeo' });
    expect(markButton().textContent).toContain('QUITAR');
  });

  it('marks the detection with Sin motivo when the reason is empty', async () => {
    api.createMarked.mockReturnValue(of({ id: 'm1', faceId: 'job-1_4', reason: 'Sin motivo' }));
    await openDetail();

    markButton().click();
    await fixture.whenStable();

    expect(api.createMarked).toHaveBeenCalledWith({ faceId: 'job-1_4', reason: 'Sin motivo' });
  });

  it('offers to remove the mark of an already marked face', async () => {
    api.getMarked.mockReturnValue(of([{ id: 'm1', faceId: 'job-1_4', reason: 'x' }]));
    api.deleteMarked.mockReturnValue(of(undefined));
    await openDetail();

    expect(markButton().textContent).toContain('QUITAR');

    markButton().click();
    await fixture.whenStable();

    expect(api.deleteMarked).toHaveBeenCalledWith('m1');
    expect(api.createMarked).not.toHaveBeenCalled();
    expect(markButton().textContent).toContain('GUARDAR');
  });

  it('shows the backend message and reloads marks on a 409', async () => {
    api.createMarked.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { status: 409, message: 'La deteccion ya esta marcada' }
      }))
    );
    await openDetail();

    markButton().click();
    await fixture.whenStable();

    expect(api.getMarked).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.mark-message').textContent)
      .toContain('La deteccion ya esta marcada');
  });

  it('does not use localStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    api.createMarked.mockReturnValue(of({ id: 'm1', faceId: 'job-1_4', reason: 'Sin motivo' }));
    await openDetail();

    markButton().click();
    await fixture.whenStable();

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  function selectFile(file: File): void {
    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('#video-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it('shows the backend error and re-enables the controls when the upload url fails', async () => {
    api.requestVideoUploadUrl.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { status: 400, message: 'Tipo de archivo no permitido' }
      }))
    );

    await create();
    component.openVideoDialog();
    selectFile(new File(['x'], 'Camera_ch6.mp4', { type: 'video/mp4' }));
    await fixture.whenStable();

    component.processVideo();
    await fixture.whenStable();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('.video-dialog');
    expect(dialog.textContent).toContain('Tipo de archivo no permitido');
    expect(dialog.textContent).not.toContain('SUBIENDO...');
    expect(dialog.querySelector<HTMLInputElement>('#video-file')?.disabled).toBe(false);
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it('disables submit after a successful upload until a new file is selected', async () => {
    api.requestVideoUploadUrl.mockReturnValue(of({
      uploadUrl: 'https://cubo.s3.amazonaws.com/videos/abc.mp4',
      bucket: 'cubo',
      objectKey: 'videos/abc.mp4',
      originalFileName: 'Camera_ch6.mp4'
    }));
    api.uploadVideoToS3.mockReturnValue(of({ type: HttpEventType.Response }));
    api.notifyVideoUploaded.mockReturnValue(of(job('QUEUED')));

    await create();
    component.openVideoDialog();
    selectFile(new File(['x'], 'Camera_ch6.mp4', { type: 'video/mp4' }));
    await fixture.whenStable();

    component.processVideo();
    await fixture.whenStable();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('.video-dialog');
    const submit = dialog.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(dialog.textContent).toContain('Video subido a S3 y registrado correctamente.');
    expect(submit?.disabled).toBe(true);
    expect(component.selectedFile()).toBeNull();
    expect(api.getVideoJobs).toHaveBeenCalledTimes(2);

    component.processVideo();
    expect(api.requestVideoUploadUrl).toHaveBeenCalledTimes(1);

    selectFile(new File(['y'], 'Otro.mkv'));
    await fixture.whenStable();

    expect(submit?.disabled).toBe(false);
    expect(api.requestVideoUploadUrl.mock.calls[0][0].contentType).toBe('video/mp4');
  });

  it('sends the inferred content type when the browser reports none', async () => {
    api.requestVideoUploadUrl.mockReturnValue(throwError(() => new Error('sin backend')));

    await create();
    component.openVideoDialog();
    selectFile(new File(['x'], 'Camera_ch6.mkv'));
    await fixture.whenStable();

    component.processVideo();

    expect(api.requestVideoUploadUrl).toHaveBeenCalledWith({
      fileName: 'Camera_ch6.mkv',
      contentType: 'video/x-matroska'
    });
  });
});
