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
import { PresignedUploadResponse, VideoJobResponse } from '../../core/models/uploadVideo';
import { FaceAppearance } from '../../core/models/face.model';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import {
  VideoStatusTone,
  videoStatusLabel,
  videoStatusTone
} from '../../core/models/video-job-status';

const ACTIVE_REFRESH_MS = 5000;
const IDLE_REFRESH_MS = 30000;
const FACES_MAX_AGE_MS = 10 * 60 * 1000;
const ACTIVE_STATUSES = ['UPLOADED', 'QUEUED', 'PROCESSING'];

interface MonitorVideo {
  id: string;
  cameraId: string;
  fileName: string;
  processedAt: string;
  status: string;
  jobId?: string;
  failureReason?: string;
  facesLoaded: boolean;
  facesLoadedAt: number;
  clusters: Array<{
    clusterId: string;
    appearances: Array<{
      faceId: string;
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
  imports: [CommonModule, FormsModule, ImageFallbackDirective],
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
  newCameraName = '';

  videos = signal<MonitorVideo[]>([]);
  selectedCluster = signal<SelectedCluster | null>(null);
  savedClusterIds = signal<string[]>([]);
  cameraVideoCounts = signal<Record<string, number>>({});

  selectedFile = signal<File | null>(null);
  processingVideo = signal(false);
  uploadProgress = signal(0);
  videoErrorMsg = signal('');
  videoSuccessMsg = signal('');

  private refreshTimer?: ReturnType<typeof setTimeout>;
  private requestToken = 0;
  private readonly loadingFaceJobs = new Set<string>();

  constructor(
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.api.getCameras().subscribe({
      next: (data) => {
        this.cameras.set(data);
        this.loading.set(false);
        this.showCamera(data[0] ?? null);
      },
      error: (err) => {
        console.error('Error loading cameras', err);

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

  cameraName(cameraId: string): string {
    return (
      this.cameras().find(camera => camera.id === cameraId)?.name ??
      cameraId
    );
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
      ACTIVE_STATUSES.includes(video.status)
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
        this.scheduleRefresh();
      }
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

    this.api.createCamera(camera).subscribe({
      next: (createdCamera) => {
        this.cameras.update(currentCameras => [
          ...currentCameras,
          createdCamera
        ]);
        this.showCamera(createdCamera);
        this.closeCameraDialog();
      },
      error: (err) => {
        console.error('Error creating camera', err);
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

  isClusterSaved(
    video: MonitorVideo,
    cluster: MonitorCluster
  ): boolean {
    return this.savedClusterIds().includes(
      this.getClusterKey(video, cluster)
    );
  }

  toggleSavedCluster(
    video: MonitorVideo,
    cluster: MonitorCluster
  ): void {
    const key = this.getClusterKey(video, cluster);

    if (this.savedClusterIds().includes(key)) {
      this.savedClusterIds.update(ids =>
        ids.filter(currentId => currentId !== key)
      );
    } else {
      this.savedClusterIds.update(ids => [
        ...ids,
        key
      ]);
    }
  }

  getCameraVideos(): MonitorVideo[] {
    return this.videos();
  }

  openVideoDialog(): void {
    if (!this.selectedCamera()) {
      return;
    }

    this.selectedFile.set(null);
    this.processingVideo.set(false);
    this.uploadProgress.set(0);
    this.videoErrorMsg.set('');
    this.videoSuccessMsg.set('');

    this.videoDialog?.nativeElement.showModal();
  }

  closeVideoDialog(): void {
    if (this.processingVideo()) {
      return;
    }

    this.videoDialog?.nativeElement.close();
    this.selectedFile.set(null);
    this.uploadProgress.set(0);
    this.videoErrorMsg.set('');
    this.videoSuccessMsg.set('');
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

  private getClusterKey(
    video: MonitorVideo,
    cluster: MonitorCluster
  ): string {
    return `${video.id}:${cluster.clusterId}`;
  }
}
