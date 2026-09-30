import { Component, ElementRef, OnInit, computed, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Camera } from '../../core/services/api.service';
import { MockModelService } from '../../core/services/mock-model';
import { ProcessingResult } from '../../shared/models/processing.models';

interface MonitorVideo {
  id: string;
  cameraId: string;
  fileName: string;
  processedAt: string;
  clusters: ProcessingResult['clusters'];
}

type MonitorCluster = ProcessingResult['clusters'][number];

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
export class MonitorComponent implements OnInit {
  @ViewChild('cameraDialog') cameraDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('videoDialog') videoDialog?: ElementRef<HTMLDialogElement>;

  cameras = signal<Camera[]>([]);
  sortedCameras = computed(() =>
  [...this.cameras()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
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
  videoErrorMsg = '';

  private readonly videosStorageKey = 'facecluster-monitor-videos-v1';
  private readonly savedClustersStorageKey = 'facecluster-saved-clusters-v1';

  constructor(
    private api: ApiService,
    private mockModelService: MockModelService
  ) {}

  ngOnInit(): void {
    this.loadLocalVideos();
    this.loadSavedClusters();

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
    const name = this.newCameraName.trim().replace(/\s+/g, ' ');

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
      this.cameraErrorMsg = 'Ya existe una cámara con ese nombre.';
      return;
    }

    const camera: Camera = {
      id: this.generateCameraId(),
      name,
      active: true
    };

    this.cameras.update(currentCameras => [
      ...currentCameras,
      camera
    ]);

    this.selectedCamera.set(camera);
    this.closeCameraDialog();
  }

    selectCluster(video: MonitorVideo, cluster: MonitorCluster): void {
    const selected = this.selectedCluster();

    if (
      selected?.video.id === video.id &&
      selected.cluster.clusterId === cluster.clusterId
    ) {
      this.selectedCluster.set(null);
      return;
    }

    this.selectedCluster.set({ video, cluster });
  }

  closeClusterDetail(): void {
    this.selectedCluster.set(null);
  }

  isClusterSaved(video: MonitorVideo, cluster: MonitorCluster): boolean {
    return this.savedClusterIds().includes(
      this.getClusterKey(video, cluster)
    );
  }

  toggleSavedCluster(video: MonitorVideo, cluster: MonitorCluster): void {
    const key = this.getClusterKey(video, cluster);

    if (this.savedClusterIds().includes(key)) {
      this.savedClusterIds.update(ids =>
        ids.filter(currentId => currentId !== key)
      );
    } else {
      this.savedClusterIds.update(ids => [...ids, key]);
    }

    this.saveSavedClusters();
  }

    getCameraVideos(): MonitorVideo[] {
    const camera = this.selectedCamera();

    if (!camera) {
      return [];
    }

    return this.videos().filter(video => video.cameraId === camera.id);
  }

  getCameraAppearanceCount(cameraId: string): number {
  return this.videos()
    .filter(video => video.cameraId === cameraId)
    .reduce(
      (total, video) =>
        total + video.clusters.reduce(
          (count, cluster) => count + cluster.appearances.length,
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
    this.videoErrorMsg = '';
    this.videoDialog?.nativeElement.showModal();
  }

  closeVideoDialog(): void {
    if (this.processingVideo) {
      return;
    }

    this.videoDialog?.nativeElement.close();
    this.selectedFile = null;
    this.videoErrorMsg = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.videoErrorMsg = '';

    if (!input.files || input.files.length === 0) {
      this.selectedFile = null;
      return;
    }

    const file = input.files[0];

    if (file.type && !file.type.startsWith('video/')) {
      this.selectedFile = null;
      input.value = '';
      this.videoErrorMsg = 'Selecciona un archivo de video válido.';
      return;
    }

    this.selectedFile = file;
  }

  async processVideo(): Promise<void> {
    const camera = this.selectedCamera();

    if (!camera) {
      this.videoErrorMsg = 'Selecciona una cámara.';
      return;
    }

    if (!this.selectedFile) {
      this.videoErrorMsg = 'Selecciona un video primero.';
      return;
    }

    try {
      this.processingVideo = true;
      this.videoErrorMsg = '';

      const result = await this.mockModelService.processVideoMock(
        this.selectedFile
      );

      const video: MonitorVideo = {
        id: this.generateVideoId(),
        cameraId: camera.id,
        fileName: result.videoName,
        processedAt: result.processedAt,
        clusters: result.clusters.map(cluster => ({
          ...cluster,
          appearances: cluster.appearances.map(appearance => ({
            ...appearance,
            cameraId: camera.id
          }))
        }))
      };

      this.videos.update(currentVideos => [
        video,
        ...currentVideos
      ]);

      this.saveLocalVideos();
      this.processingVideo = false;
      this.closeVideoDialog();
    } catch {
      this.processingVideo = false;
      this.videoErrorMsg =
        'Ocurrió un error durante el procesamiento simulado.';
    }
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
      const content = localStorage.getItem(this.videosStorageKey);

      if (!content) {
        return;
      }

      const savedVideos = JSON.parse(content);

      if (Array.isArray(savedVideos)) {
        this.videos.set(savedVideos);
      }
    } catch {
      console.warn('No fue posible recuperar los videos guardados.');
    }
  }

  private saveLocalVideos(): void {
    try {
      localStorage.setItem(
        this.videosStorageKey,
        JSON.stringify(this.videos())
      );
    } catch {
      console.warn('No fue posible guardar los videos.');
    }
  }

  private generateVideoId(): string {
    const videoNumbers = this.videos()
      .map(video => Number(video.id.replace(/\D/g, '')))
      .filter(number => Number.isFinite(number));

    const nextNumber = Math.max(...videoNumbers, 0) + 1;

    return `VIDEO-${String(nextNumber).padStart(3, '0')}`;
  }

  private generateCameraId(): string {
    const cameraNumbers = this.cameras()
      .map(camera => Number(camera.id.replace(/\D/g, '')))
      .filter(number => Number.isFinite(number));

    const nextNumber = Math.max(...cameraNumbers, 0) + 1;

    return `CAM-${String(nextNumber).padStart(2, '0')}`;
  }
}
