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
import { Subscription, interval } from 'rxjs';

import {
  ApiService,
  Camera
} from '../../core/services/api.service';
import { PresignedUploadResponse, VideoJobResponse } from '../../core/models/uploadVideo';
import { FaceAppearance } from '../../core/models/face.model';
import {
  VideoStatusTone,
  isTerminalStatus,
  videoStatusLabel,
  videoStatusTone
} from '../../core/models/video-job-status';

const JOB_STATUS_POLL_MS = 5000;

interface MonitorVideo {
  id: string;
  cameraId: string;
  fileName: string;
  processedAt: string;
  status: string;
  jobId?: string;
  failureReason?: string;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './monitor.html',
  styleUrl: './monitor.css',
})
export class MonitorComponent implements OnInit, OnDestroy {
  @ViewChild('cameraDialog')
  cameraDialog?: ElementRef<HTMLDialogElement>;

  @ViewChild('videoDialog')
  videoDialog?: ElementRef<HTMLDialogElement>;

  cameras = signal<Camera[]>([]);

  sortedCameras = computed(() =>
    [...this.cameras()].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', {
        sensitivity: 'base'
      })
    )
  );

  selectedCamera = signal<Camera | null>(null);

  loading = true;
  errorMsg = '';
  cameraErrorMsg = '';
  newCameraName = '';

  videos = signal<MonitorVideo[]>([]);
  selectedCluster = signal<SelectedCluster | null>(null);
  savedClusterIds = signal<string[]>([]);

  selectedFile: File | null = null;
  processingVideo = false;
  uploadProgress = 0;
  videoErrorMsg = '';
  videoSuccessMsg = '';

  private readonly videosStorageKey =
    'facecluster-monitor-videos-v1';

  private readonly savedClustersStorageKey =
    'facecluster-saved-clusters-v1';

  private jobStatusPolling?: Subscription;

  constructor(
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.loadLocalVideos();
    this.loadSavedClusters();

    this.refreshPendingVideos();
    this.jobStatusPolling = interval(JOB_STATUS_POLL_MS).subscribe(
      () => this.refreshPendingVideos()
    );

    this.api.getCameras().subscribe({
      next: (data) => {
        console.log('CAMERAS API =>', data);

        this.cameras.set(data);
        this.selectedCamera.set(data[0] ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading cameras', err);

        this.cameras.set([]);
        this.selectedCamera.set(null);
        this.errorMsg = 'No se pudieron cargar las cámaras.';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.jobStatusPolling?.unsubscribe();
  }

  statusLabel(status: string): string {
    return videoStatusLabel(status);
  }

  statusTone(status: string): VideoStatusTone {
    return videoStatusTone(status);
  }

  refreshPendingVideos(): void {
    for (const video of this.videos()) {
      if (!video.jobId || isTerminalStatus(video.status)) {
        continue;
      }

      this.api.getVideoJob(video.jobId).subscribe({
        next: job => this.applyJobStatus(job),
        error: error => {
          console.warn(
            'No se pudo consultar el estado del video',
            error
          );
        }
      });
    }
  }

  private applyJobStatus(job: VideoJobResponse): void {
    this.updateVideo(job.jobId, video => ({
      ...video,
      status: job.status,
      failureReason: job.failureReason ?? undefined
    }));

    if (job.status === 'COMPLETED') {
      this.loadJobFaces(job.jobId);
    }
  }

  private loadJobFaces(jobId: string): void {
    this.api.getFaceAppearances().subscribe({
      next: appearances => {
        const clusters = appearances
          .filter(appearance =>
            appearance.faceId.startsWith(`${jobId}_`)
          )
          .map(appearance => this.toCluster(appearance));

        this.updateVideo(jobId, video => ({
          ...video,
          clusters
        }));
      },
      error: error => {
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

    this.saveLocalVideos();
  }

  selectCamera(camera: Camera): void {
    this.selectedCamera.set(camera);
    this.selectedCluster.set(null);
  }

  openCameraDialog(): void {
    this.newCameraName = '';
    this.cameraErrorMsg = '';
    this.cameraDialog?.nativeElement.showModal();
  }

  closeCameraDialog(): void {
    this.cameraDialog?.nativeElement.close();
    this.newCameraName = '';
    this.cameraErrorMsg = '';
  }

  addCamera(): void {
    const name = this.newCameraName
      .trim()
      .replace(/\s+/g, ' ');

    if (name.length < 3) {
      this.cameraErrorMsg =
        'Escribe un nombre de al menos tres caracteres.';
      return;
    }

    const exists = this.cameras().some(
      camera =>
        camera.name.toLocaleLowerCase('es') ===
        name.toLocaleLowerCase('es')
    );

    if (exists) {
      this.cameraErrorMsg =
        'Ya existe una cámara con ese nombre.';
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
        this.selectedCamera.set(createdCamera);
        this.closeCameraDialog();
      },
      error: (err) => {
        console.error('Error creating camera', err);
        this.cameraErrorMsg = 'No se pudo registrar la cámara.';
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

    this.saveSavedClusters();
  }

  getCameraVideos(): MonitorVideo[] {
    const camera = this.selectedCamera();

    if (!camera) {
      return [];
    }

    return this.videos().filter(
      video => video.cameraId === camera.id
    );
  }

  getCameraAppearanceCount(cameraId: string): number {
    return this.videos()
      .filter(video => video.cameraId === cameraId)
      .reduce(
        (total, video) =>
          total +
          video.clusters.reduce(
            (count, cluster) =>
              count + cluster.appearances.length,
            0
          ),
        0
      );
  }

  openVideoDialog(): void {
    if (!this.selectedCamera()) {
      return;
    }

    this.selectedFile = null;
    this.processingVideo = false;
    this.uploadProgress = 0;
    this.videoErrorMsg = '';
    this.videoSuccessMsg = '';

    this.videoDialog?.nativeElement.showModal();
  }

  closeVideoDialog(): void {
    if (this.processingVideo) {
      return;
    }

    this.videoDialog?.nativeElement.close();
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.videoErrorMsg = '';
    this.videoSuccessMsg = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.videoErrorMsg = '';
    this.videoSuccessMsg = '';
    this.uploadProgress = 0;

    if (!input.files || input.files.length === 0) {
      this.selectedFile = null;
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith('video/')) {
      this.selectedFile = null;
      input.value = '';
      this.videoErrorMsg =
        'Selecciona un archivo de video válido.';
      return;
    }

    this.selectedFile = file;
  }

  processVideo(): void {
    const camera = this.selectedCamera();

    if (!camera) {
      this.videoErrorMsg = 'Selecciona una cámara.';
      return;
    }

    if (!this.selectedFile) {
      this.videoErrorMsg =
        'Selecciona un video primero.';
      return;
    }

    const file = this.selectedFile;

    this.processingVideo = true;
    this.uploadProgress = 0;
    this.videoErrorMsg = '';
    this.videoSuccessMsg = '';

    this.api.requestVideoUploadUrl({
      fileName: file.name,
      contentType: file.type
    }).subscribe({
      next: uploadData => {
        this.uploadFileToS3(
          uploadData,
          camera,
          file
        );
      },
      error: error => {
        console.error(
          'Error solicitando URL prefirmada',
          error
        );

        this.videoErrorMsg =
          'No se pudo preparar la carga del video.';
        this.processingVideo = false;
      }
    });
  }

  private uploadFileToS3(
    uploadData: PresignedUploadResponse,
    camera: Camera,
    file: File
  ): void {
    this.api.uploadVideoToS3(
      uploadData.uploadUrl,
      file
    ).subscribe({
      next: event => {
        if (
          event.type === HttpEventType.UploadProgress &&
          event.total
        ) {
          this.uploadProgress = Math.round(
            (event.loaded / event.total) * 100
          );
        }

        if (event.type === HttpEventType.Response) {
          this.uploadProgress = 100;

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

        this.videoErrorMsg =
          'No se pudo subir el video a AWS S3. ' +
          'Verifica el CORS del bucket.';
        this.processingVideo = false;
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
      next: job => {
        this.addUploadedVideo(job, camera);

        this.videoSuccessMsg =
          'Video subido a S3 y registrado correctamente.';

        this.processingVideo = false;
      },
      error: error => {
        console.error(
          'Error notificando video al backend',
          error
        );

        this.videoErrorMsg =
          'El video se subió a S3, pero no se pudo ' +
          'registrar en el backend.';
        this.processingVideo = false;
      }
    });
  }

  private addUploadedVideo(
    job: VideoJobResponse,
    camera: Camera
  ): void {
    const video: MonitorVideo = {
      id: job.jobId,
      jobId: job.jobId,
      cameraId: camera.id,
      fileName: job.originalFileName,
      processedAt: job.createdAt,
      status: job.status,
      clusters: []
    };

    this.videos.update(currentVideos => [
      video,
      ...currentVideos
    ]);

    this.saveLocalVideos();
  }

  private getClusterKey(
    video: MonitorVideo,
    cluster: MonitorCluster
  ): string {
    return `${video.id}:${cluster.clusterId}`;
  }

  private loadSavedClusters(): void {
    try {
      const content = localStorage.getItem(
        this.savedClustersStorageKey
      );

      if (!content) {
        return;
      }

      const savedIds = JSON.parse(content);

      if (Array.isArray(savedIds)) {
        this.savedClusterIds.set(savedIds);
      }
    } catch {
      console.warn(
        'No fue posible recuperar las detecciones guardadas.'
      );
    }
  }

  private saveSavedClusters(): void {
    try {
      localStorage.setItem(
        this.savedClustersStorageKey,
        JSON.stringify(this.savedClusterIds())
      );
    } catch {
      console.warn(
        'No fue posible guardar las detecciones.'
      );
    }
  }

  private loadLocalVideos(): void {
    try {
      const content = localStorage.getItem(
        this.videosStorageKey
      );

      if (!content) {
        return;
      }

      const savedVideos = JSON.parse(content);

      if (Array.isArray(savedVideos)) {
        this.videos.set(savedVideos);
      }
    } catch {
      console.warn(
        'No fue posible recuperar los videos guardados.'
      );
    }
  }

  private saveLocalVideos(): void {
    try {
      localStorage.setItem(
        this.videosStorageKey,
        JSON.stringify(this.videos())
      );
    } catch {
      console.warn(
        'No fue posible guardar los videos.'
      );
    }
  }

}