import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { apiErrorMessage } from '../../core/services/api-error';
import { videoContentType } from '../../core/models/video-content-type';

import {
  ApiService,
  Camera
} from '../../core/services/api.service';
import { PresignedUploadResponse, VideoJobMetrics, VideoJobResponse } from '../../core/models/uploadVideo';
import { describeVideoTimings, formatDuration } from '../../core/models/duration-format';
import { MetricsStripComponent } from './metrics-strip';
import { VideoRetryComponent } from './video-retry/video-retry';
import { FaceAppearance } from '../../core/models/face.model';
import { FaceTileComponent } from './face-tile/face-tile';
import { MarksService } from '../../shared/services/marks.service';
import { DetectionDetailComponent } from '../../shared/components/detection-detail/detection-detail';
import {
  VideoStatusTone,
  isTerminalStatus,
  videoStatusLabel,
  videoStatusTone
} from '../../core/models/video-job-status';

const ACTIVE_REFRESH_MS = 5000;
const IDLE_REFRESH_MS = 30000;
const FACES_MAX_AGE_MS = 10 * 60 * 1000;

interface MonitorVideo {
  id: string;
  cameraId: string;
  fileName: string;
  processedAt: string;
  status: string;
  jobId?: string;
  failureReason?: string;
  timings: string;
  facesLoaded: boolean;
  facesLoadedAt: number;
  clusters: Array<{
    clusterId: string;
    appearances: Array<{
      faceId: string;
      jobId?: string;
      timestamp: string;
      cameraId: string;
      frameUrl?: string;
      capturedAt?: string;
    }>;
  }>;
}

type MonitorCluster = MonitorVideo['clusters'][number];

interface SelectedCluster {
  video: MonitorVideo;
  cluster: MonitorCluster;
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, FaceTileComponent, MetricsStripComponent, VideoRetryComponent, DetectionDetailComponent],
  templateUrl: './monitor.html',
  styleUrl: './monitor.css',
})
export class MonitorComponent implements OnInit, OnDestroy {
  @ViewChild('cameraDialog')
  cameraDialog?: ElementRef<HTMLDialogElement>;

  @ViewChild('videoDialog')
  videoDialog?: ElementRef<HTMLDialogElement>;

  @ViewChild('videoFileInput')
  videoFileInput?: ElementRef<HTMLInputElement>;

  cameras = signal<Camera[]>([]);

  sortedCameras = computed(() =>
    [...this.cameras()].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', {
        sensitivity: 'base'
      })
    )
  );

  selectedCamera = signal<Camera | null>(null);

  loading = signal(true);
  errorMsg = signal('');
  cameraErrorMsg = signal('');
  savingCamera = signal(false);
  newCameraName = '';

  videos = signal<MonitorVideo[]>([]);
  videosLoading = signal(false);
  metrics = signal<VideoJobMetrics | null>(null);
  metricsErrorMsg = signal('');
  metricItems = computed(() => {
    const metrics = this.metrics();

    if (!metrics) {
      return [];
    }

    return [
      { label: 'Videos', value: `${metrics.total}` },
      { label: 'Completados', value: `${metrics.completed}` },
      { label: 'Fallidos', value: `${metrics.failed}` },
      { label: 'Tasa de fallo', value: `${Math.round(metrics.failureRate * 100)} %` },
      { label: 'Espera media', value: this.durationOrNone(metrics.averageQueueWaitSeconds) },
      { label: 'Procesamiento medio', value: this.durationOrNone(metrics.averageProcessingSeconds) },
      { label: 'Detecciones totales', value: `${metrics.totalFaces}` }
    ];
  });
  selectedCluster = signal<SelectedCluster | null>(null);
  cameraVideoCounts = signal<Record<string, number>>({});
  retryingJobs = signal<ReadonlySet<string>>(new Set());
  retryErrors = signal<Record<string, string>>({});

  selectedFile = signal<File | null>(null);
  processingVideo = signal(false);
  uploadProgress = signal(0);
  videoErrorMsg = signal('');
  videoSuccessMsg = signal('');

  private refreshTimer?: ReturnType<typeof setTimeout>;
  private requestToken = 0;
  private readonly loadingFaceJobs = new Set<string>();

  constructor(
    private api: ApiService,
    private marks: MarksService
  ) {}

  ngOnInit(): void {

    this.marks.load();

    this.api.getCameras().subscribe({
      next: (data) => {
        this.cameras.set(data);
        this.loading.set(false);
        this.showCamera(data[0] ?? null);
      },
      error: (err) => {
        console.error('Error al cargar las cámaras', err);

        this.cameras.set([]);
        this.selectedCamera.set(null);
        this.errorMsg.set('No se pudieron cargar las cámaras.');
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopRefresh();
  }

  statusLabel(status: string): string {
    return videoStatusLabel(status);
  }

  statusTone(status: string): VideoStatusTone {
    return videoStatusTone(status);
  }

  cameraVideoCountLabel(cameraId: string): string {
    const count = this.cameraVideoCounts()[cameraId];

    if (count === undefined) {
      return '';
    }

    return `${count} ${count === 1 ? 'video' : 'videos'}`;
  }

  private showCamera(camera: Camera | null): void {
    this.stopRefresh();
    this.requestToken++;
    this.selectedCamera.set(camera);
    this.selectedCluster.set(null);
    this.videos.set([]);
    this.metrics.set(null);
    this.metricsErrorMsg.set('');
    this.videosLoading.set(camera !== null);
    this.loadingFaceJobs.clear();

    if (camera) {
      this.loadVideos();
    }
  }

  private stopRefresh(): void {
    if (this.refreshTimer !== undefined) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private scheduleRefresh(): void {
    this.stopRefresh();

    const hasActiveJobs = this.videos().some(video =>
      !isTerminalStatus(video.status)
    );

    this.refreshTimer = setTimeout(
      () => this.loadVideos(),
      hasActiveJobs ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS
    );
  }

  private loadVideos(): void {
    const camera = this.selectedCamera();

    if (!camera) {
      return;
    }

    this.stopRefresh();
    const token = ++this.requestToken;
    this.loadingFaceJobs.clear();
    this.loadMetrics(camera.id, token);

    this.api.getVideoJobs(camera.id).subscribe({
      next: jobs => {
        if (token !== this.requestToken) {
          return;
        }

        const previous = new Map(
          this.videos().map(video => [video.jobId, video])
        );

        this.videos.set(
          jobs.map(job => this.toVideo(job, previous.get(job.jobId)))
        );
        this.cameraVideoCounts.update(counts => ({
          ...counts,
          [camera.id]: jobs.length
        }));
        this.errorMsg.set('');
        this.videosLoading.set(false);

        for (const job of jobs) {
          if (job.status === 'COMPLETED') {
            this.loadJobFaces(job.jobId, token);
          }
        }

        this.scheduleRefresh();
      },
      error: error => {
        if (token !== this.requestToken) {
          return;
        }

        console.warn('No se pudieron cargar los videos', error);
        this.errorMsg.set(
          apiErrorMessage(
            error,
            'No se pudieron cargar los videos de la cámara.'
          )
        );
        this.videosLoading.set(false);
        this.scheduleRefresh();
      }
    });
  }

  private loadMetrics(cameraId: string, token: number): void {
    this.api.getVideoJobMetrics(cameraId).subscribe({
      next: metrics => {
        if (token !== this.requestToken) {
          return;
        }

        this.metrics.set(metrics);
        this.metricsErrorMsg.set('');
      },
      error: error => {
        if (token !== this.requestToken) {
          return;
        }

        console.warn('No se pudieron cargar las métricas', error);
        this.metricsErrorMsg.set(
          apiErrorMessage(
            error,
            'No se pudieron cargar las métricas de procesamiento.'
          )
        );
      }
    });
  }

  private durationOrNone(seconds: number | null): string {
    return seconds === null ? 'Sin datos' : formatDuration(seconds);
  }

  retryLoad(): void {
    this.loadVideos();
  }

  canRetry(video: MonitorVideo): boolean {
    return video.status === 'FAILED' || video.status === 'QUEUE_ERROR';
  }

  retryVideo(video: MonitorVideo): void {
    const jobId = video.jobId;

    if (!jobId || this.retryingJobs().has(jobId)) {
      return;
    }

    this.retryingJobs.update(jobs => new Set(jobs).add(jobId));
    this.retryErrors.update(errors => ({ ...errors, [jobId]: '' }));

    this.api.retryVideoJob(jobId).subscribe({
      next: () => {
        this.finishRetry(jobId);
        this.loadVideos();
      },
      error: error => {
        this.finishRetry(jobId);
        this.retryErrors.update(errors => ({
          ...errors,
          [jobId]: apiErrorMessage(error, 'No se pudo reintentar el video')
        }));
      }
    });
  }

  private finishRetry(jobId: string): void {
    this.retryingJobs.update(jobs => {
      const next = new Set(jobs);
      next.delete(jobId);
      return next;
    });
  }

  private toVideo(
    job: VideoJobResponse,
    previous?: MonitorVideo
  ): MonitorVideo {
    const keepFaces =
      previous?.facesLoaded === true && job.status === 'COMPLETED';

    return {
      id: job.jobId,
      jobId: job.jobId,
      cameraId: job.cameraId,
      fileName: job.originalFileName,
      processedAt: job.createdAt,
      status: job.status,
      failureReason: job.failureReason ?? undefined,
      timings: describeVideoTimings(job),
      facesLoaded: keepFaces,
      facesLoadedAt: keepFaces ? previous.facesLoadedAt : 0,
      clusters: keepFaces ? previous.clusters : []
    };
  }

  private loadJobFaces(jobId: string, token: number): void {
    const video = this.videos().find(item => item.jobId === jobId);

    if (!video || this.loadingFaceJobs.has(jobId)) {
      return;
    }

    const facesAreFresh =
      video.facesLoaded &&
      Date.now() - video.facesLoadedAt < FACES_MAX_AGE_MS;

    if (facesAreFresh) {
      return;
    }

    this.loadingFaceJobs.add(jobId);

    this.api.getVideoJobFaces(jobId).subscribe({
      next: appearances => {
        if (token !== this.requestToken) {
          return;
        }

        this.loadingFaceJobs.delete(jobId);

        this.updateVideo(jobId, current => ({
          ...current,
          facesLoaded: true,
          facesLoadedAt: Date.now(),
          clusters: appearances.map(appearance =>
            this.toCluster(appearance)
          )
        }));
      },
      error: error => {
        if (token !== this.requestToken) {
          return;
        }

        this.loadingFaceJobs.delete(jobId);
        console.warn(
          'No se pudieron cargar los rostros del video',
          error
        );
      }
    });
  }

  private toCluster(appearance: FaceAppearance): MonitorCluster {
    return {
      clusterId: appearance.faceId,
      appearances: [
        {
          faceId: appearance.faceId,
          jobId: appearance.jobId,
          timestamp: appearance.timestamp,
          cameraId: appearance.cameraId,
          frameUrl: appearance.frameUrl,
          capturedAt: appearance.capturedAt
        }
      ]
    };
  }

  private updateVideo(
    jobId: string,
    change: (video: MonitorVideo) => MonitorVideo
  ): void {
    this.videos.update(currentVideos =>
      currentVideos.map(video =>
        video.jobId === jobId ? change(video) : video
      )
    );
  }

  selectCamera(camera: Camera): void {
    this.showCamera(camera);
  }

  openCameraDialog(): void {
    this.newCameraName = '';
    this.cameraErrorMsg.set('');
    this.cameraDialog?.nativeElement.showModal();
  }

  closeCameraDialog(): void {
    this.cameraDialog?.nativeElement.close();
    this.newCameraName = '';
    this.cameraErrorMsg.set('');
  }

  addCamera(): void {
    if (this.savingCamera()) {
      return;
    }

    const name = this.newCameraName
      .trim()
      .replace(/\s+/g, ' ');

    if (name.length < 3) {
      this.cameraErrorMsg.set(
        'Escribe un nombre de al menos tres caracteres.'
      );
      return;
    }

    const exists = this.cameras().some(
      camera =>
        camera.name.toLocaleLowerCase('es') ===
        name.toLocaleLowerCase('es')
    );

    if (exists) {
      this.cameraErrorMsg.set(
        'Ya existe una cámara con ese nombre.'
      );
      return;
    }

    const camera: Omit<Camera, 'id'> = {
      name,
      active: true
    };

    this.savingCamera.set(true);

    this.api.createCamera(camera).subscribe({
      next: (createdCamera) => {
        this.savingCamera.set(false);
        this.cameras.update(currentCameras => [
          ...currentCameras,
          createdCamera
        ]);
        this.showCamera(createdCamera);
        this.closeCameraDialog();
      },
      error: (err) => {
        console.error('Error al registrar la cámara', err);
        this.savingCamera.set(false);
        this.cameraErrorMsg.set(
          apiErrorMessage(err, 'No se pudo registrar la cámara.')
        );
      }
    });
  }

  selectCluster(
    video: MonitorVideo,
    cluster: MonitorCluster
  ): void {
    const selected = this.selectedCluster();

    if (
      selected?.video.id === video.id &&
      selected.cluster.clusterId === cluster.clusterId
    ) {
      this.selectedCluster.set(null);
      return;
    }

    this.selectedCluster.set({
      video,
      cluster
    });
  }

  closeClusterDetail(): void {
    this.selectedCluster.set(null);
  }

  getCameraVideos(): MonitorVideo[] {
    return this.videos();
  }

  trackVideo(index: number, video: MonitorVideo): string {
    return video.id;
  }

  trackCluster(index: number, cluster: MonitorCluster): string {
    return cluster.clusterId;
  }

  openVideoDialog(): void {
    if (!this.selectedCamera()) {
      return;
    }

    if (!this.processingVideo()) {
      this.resetVideoForm();
    }

    this.videoDialog?.nativeElement.showModal();
  }

  closeVideoDialog(event?: Event): void {
    if (this.processingVideo()) {
      event?.preventDefault();
      return;
    }

    this.videoDialog?.nativeElement.close();
    this.resetVideoForm();
  }

  private resetVideoForm(): void {
    this.selectedFile.set(null);
    this.uploadProgress.set(0);
    this.videoErrorMsg.set('');
    this.videoSuccessMsg.set('');

    if (this.videoFileInput) {
      this.videoFileInput.nativeElement.value = '';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.videoErrorMsg.set('');
    this.videoSuccessMsg.set('');
    this.uploadProgress.set(0);

    if (!input.files || input.files.length === 0) {
      this.selectedFile.set(null);
      return;
    }

    const file = input.files[0];

    if (!videoContentType(file).startsWith('video/')) {
      this.selectedFile.set(null);
      input.value = '';
      this.videoErrorMsg.set(
        'Selecciona un archivo de video válido.'
      );
      return;
    }

    this.selectedFile.set(file);
  }

  processVideo(): void {
    const camera = this.selectedCamera();

    if (!camera) {
      this.videoErrorMsg.set('Selecciona una cámara.');
      return;
    }

    const file = this.selectedFile();

    if (this.processingVideo()) {
      return;
    }

    if (!file) {
      this.videoErrorMsg.set(
        'Selecciona un video primero.'
      );
      return;
    }

    const contentType = videoContentType(file);

    this.processingVideo.set(true);
    this.uploadProgress.set(0);
    this.videoErrorMsg.set('');
    this.videoSuccessMsg.set('');

    this.api.requestVideoUploadUrl({
      fileName: file.name,
      contentType
    }).subscribe({
      next: uploadData => {
        this.uploadFileToS3(
          uploadData,
          camera,
          file,
          contentType
        );
      },
      error: error => {
        console.error(
          'Error solicitando URL prefirmada',
          error
        );

        this.videoErrorMsg.set(
          apiErrorMessage(
            error,
            'No se pudo preparar la carga del video.'
          )
        );
        this.processingVideo.set(false);
      }
    });
  }

  private uploadFileToS3(
    uploadData: PresignedUploadResponse,
    camera: Camera,
    file: File,
    contentType: string
  ): void {
    this.api.uploadVideoToS3(
      uploadData.uploadUrl,
      file,
      contentType
    ).subscribe({
      next: event => {
        if (
          event.type === HttpEventType.UploadProgress &&
          event.total
        ) {
          this.uploadProgress.set(
            Math.round((event.loaded / event.total) * 100)
          );
        }

        if (event.type === HttpEventType.Response) {
          this.uploadProgress.set(100);

          this.notifyBackend(
            uploadData,
            camera
          );
        }
      },
      error: error => {
        console.error(
          'Error subiendo video a S3',
          error
        );

        this.videoErrorMsg.set(
          'No se pudo subir el video a AWS S3. ' +
          'Verifica el CORS del bucket.'
        );
        this.processingVideo.set(false);
      }
    });
  }

  private notifyBackend(
    uploadData: PresignedUploadResponse,
    camera: Camera
  ): void {
    this.api.notifyVideoUploaded({
      originalFileName: uploadData.originalFileName,
      bucket: uploadData.bucket,
      objectKey: uploadData.objectKey,
      cameraId: camera.id
    }).subscribe({
      next: () => {
        this.loadVideos();

        this.videoSuccessMsg.set(
          'Video subido a S3 y registrado correctamente.'
        );

        this.selectedFile.set(null);

        if (this.videoFileInput) {
          this.videoFileInput.nativeElement.value = '';
        }

        this.processingVideo.set(false);
      },
      error: error => {
        console.error(
          'Error notificando video al backend',
          error
        );

        this.videoErrorMsg.set(
          apiErrorMessage(
            error,
            'El video se subió a S3, pero no se pudo ' +
              'registrar en el backend.'
          )
        );
        this.processingVideo.set(false);
      }
    });
  }
}
