import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { VideoJobResponse } from '../../core/models/uploadVideo';
import { MonitorComponent } from './monitor';

const VIDEOS_KEY = 'facecluster-monitor-videos-v1';

function storedVideo(status: string) {
  return {
    id: 'job-1',
    jobId: 'job-1',
    cameraId: 'CAM-01',
    fileName: 'Camera_ch6.mp4',
    processedAt: '2026-11-14T12:00:00Z',
    status,
    clusters: []
  };
}

function job(status: string, failureReason: string | null = null): VideoJobResponse {
  return {
    jobId: 'job-1',
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

describe('MonitorComponent', () => {
  let fixture: ComponentFixture<MonitorComponent>;
  let component: MonitorComponent;
  let api: {
    getCameras: ReturnType<typeof vi.fn>;
    getVideoJob: ReturnType<typeof vi.fn>;
    getFaceAppearances: ReturnType<typeof vi.fn>;
    requestVideoUploadUrl: ReturnType<typeof vi.fn>;
    uploadVideoToS3: ReturnType<typeof vi.fn>;
    notifyVideoUploaded: ReturnType<typeof vi.fn>;
  };

  async function createWith(status: string): Promise<void> {
    localStorage.setItem(VIDEOS_KEY, JSON.stringify([storedVideo(status)]));

    await TestBed.configureTestingModule({
      imports: [MonitorComponent],
      providers: [{ provide: ApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(MonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    localStorage.clear();
    api = {
      getCameras: vi.fn(() =>
        of([{ id: 'CAM-01', name: 'Entrada', active: true }])
      ),
      getVideoJob: vi.fn(() => of(job('QUEUED'))),
      getFaceAppearances: vi.fn(() => of([])),
      requestVideoUploadUrl: vi.fn(),
      uploadVideoToS3: vi.fn(),
      notifyVideoUploaded: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
    localStorage.clear();
  });

  it('shows the failure reason of a failed job', async () => {
    api.getVideoJob.mockReturnValue(of(job('FAILED', 'video no encontrado')));

    await createWith('QUEUED');

    const video = component.videos()[0];
    expect(video.status).toBe('FAILED');
    expect(video.failureReason).toBe('video no encontrado');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fallido');
    expect(text).toContain('video no encontrado');

    const saved = JSON.parse(localStorage.getItem(VIDEOS_KEY) ?? '[]');
    expect(saved[0].status).toBe('FAILED');
  });

  it('loads the faces of a completed job', async () => {
    api.getVideoJob.mockReturnValue(of(job('COMPLETED')));
    api.getFaceAppearances.mockReturnValue(of([
      {
        id: 'a',
        faceId: 'job-1_4',
        timestamp: '00:01:23',
        cameraId: 'CAM-01',
        frameUrl: 'https://cubo.s3.us-east-2.amazonaws.com/faces/job-1/4.jpg?firma',
        capturedAt: '2026-10-16T10:05:21'
      },
      {
        id: 'b',
        faceId: 'otro-job_1',
        timestamp: '00:00:02',
        cameraId: 'CAM-01'
      }
    ]));

    await createWith('PROCESSING');

    const video = component.videos()[0];
    expect(video.status).toBe('COMPLETED');
    expect(video.clusters).toEqual([
      {
        clusterId: 'job-1_4',
        appearances: [
          {
            faceId: 'job-1_4',
            timestamp: '00:01:23',
            cameraId: 'CAM-01',
            capturedAt: '2026-10-16T10:05:21'
          }
        ]
      }
    ]);
    expect(fixture.nativeElement.textContent).toContain('Completado');
  });

  it('does not ask the backend about finished jobs', async () => {
    await createWith('COMPLETED');

    expect(api.getVideoJob).not.toHaveBeenCalled();
  });

  it('keeps the last known status when the backend does not answer', async () => {
    api.getVideoJob.mockReturnValue(throwError(() => new Error('sin backend')));

    await createWith('QUEUED');

    expect(component.videos()[0].status).toBe('QUEUED');
    expect(fixture.nativeElement.textContent).toContain('En cola');
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

    await createWith('COMPLETED');
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

    await createWith('COMPLETED');
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

    component.processVideo();
    expect(api.requestVideoUploadUrl).toHaveBeenCalledTimes(1);

    selectFile(new File(['y'], 'Otro.mkv'));
    await fixture.whenStable();

    expect(submit?.disabled).toBe(false);
    expect(api.requestVideoUploadUrl.mock.calls[0][0].contentType).toBe('video/mp4');
  });

  it('sends the inferred content type when the browser reports none', async () => {
    api.requestVideoUploadUrl.mockReturnValue(throwError(() => new Error('sin backend')));

    await createWith('COMPLETED');
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
