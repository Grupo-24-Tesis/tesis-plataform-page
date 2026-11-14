import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { ApiService } from './api.service';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the video jobs of a camera', () => {
    api.getVideoJobs('CAM-01').subscribe();

    const request = http.expectOne(
      r => r.url === 'http://localhost:8080/api/video-jobs'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('cameraId')).toBe('CAM-01');
    request.flush([]);
  });

  it('requests all video jobs without a camera filter', () => {
    api.getVideoJobs().subscribe();

    const request = http.expectOne(
      r => r.url === 'http://localhost:8080/api/video-jobs'
    );
    expect(request.request.params.has('cameraId')).toBe(false);
    request.flush([]);
  });

  it('requests the processing metrics of a camera', () => {
    api.getVideoJobMetrics('CAM-01').subscribe();

    const request = http.expectOne(
      r => r.url === 'http://localhost:8080/api/metrics/video-jobs'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('cameraId')).toBe('CAM-01');
    request.flush({});
  });

  it('requests the processing metrics without a camera filter', () => {
    api.getVideoJobMetrics().subscribe();

    const request = http.expectOne(
      r => r.url === 'http://localhost:8080/api/metrics/video-jobs'
    );
    expect(request.request.params.has('cameraId')).toBe(false);
    request.flush({});
  });

  it('requests the faces of a video job', () => {
    api.getVideoJobFaces('job-1').subscribe();

    const request = http.expectOne(
      'http://localhost:8080/api/video-jobs/job-1/faces'
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('requests the activity with every filter', () => {
    api.getActivity('CAM-01', '2026-05-01', '2026-05-31').subscribe();

    const request = http.expectOne(
      r => r.url === 'http://localhost:8080/api/metrics/activity'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('cameraId')).toBe('CAM-01');
    expect(request.request.params.get('startDate')).toBe('2026-05-01');
    expect(request.request.params.get('endDate')).toBe('2026-05-31');
    request.flush({ hours: [], cameras: [], total: 0 });
  });

  it('requests the activity without filters', () => {
    api.getActivity().subscribe();

    const request = http.expectOne(
      r => r.url === 'http://localhost:8080/api/metrics/activity'
    );
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ hours: [], cameras: [], total: 0 });
  });
});
