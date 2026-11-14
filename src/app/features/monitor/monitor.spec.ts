import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    localStorage.clear();
    api = {
      getCameras: vi.fn(() =>
        of([{ id: 'CAM-01', name: 'Entrada', active: true }])
      ),
      getVideoJob: vi.fn(() => of(job('QUEUED'))),
      getFaceAppearances: vi.fn(() => of([]))
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
});
