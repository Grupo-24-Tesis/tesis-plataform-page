import { Component, ElementRef, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Camera } from '../../core/services/api.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './monitor.html',
  styleUrl: './monitor.css',
})
export class MonitorComponent implements OnInit {
  @ViewChild('cameraDialog') cameraDialog?: ElementRef<HTMLDialogElement>;

  cameras = signal<Camera[]>([]);
  selectedCamera = signal<Camera | null>(null);
  loading = true;
  errorMsg = '';
  cameraErrorMsg = '';
  newCameraName = '';

  private readonly storageKey = 'facecluster-cameras-v1';

  private readonly demoCameras: Camera[] = [
    {
      id: 'CAM-01',
      name: 'Entrada Principal',
      active: true
    },
    {
      id: 'CAM-02',
      name: 'Parqueadero A',
      active: true
    },
    {
      id: 'CAM-03',
      name: 'Zona Común Piscina',
      active: true
    },
    {
      id: 'CAM-04',
      name: 'Torre B - Lobby',
      active: true
    },
    {
      id: 'CAM-05',
      name: 'Torre A - Lobby',
      active: true
    },
    {
      id: 'CAM-06',
      name: 'Salida Vehicular',
      active: true
    },
    {
      id: 'CAM-07',
      name: 'Cuarto de Bombas',
      active: true
    },
    {
      id: 'CAM-08',
      name: 'Cancha Múltiple',
      active: true
    }
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    const localCameras = this.loadLocalCameras();

    if (localCameras.length > 0) {
      this.cameras.set(localCameras);
      this.selectedCamera.set(localCameras[0]);
    }

    this.api.getCameras().subscribe({
      next: (data) => {
        console.log('CAMERAS API =>', data);

        if (data.length > 0) {
          const cameras = this.mergeCameras(data, localCameras);
          this.cameras.set(cameras);
          this.selectedCamera.set(cameras[0]);
          this.saveLocalCameras();
        } else if (localCameras.length === 0) {
          this.useDemoCameras();
        }

        this.loading = false;
      },
      error: (err) => {
        console.error(err);

        if (localCameras.length === 0) {
          this.useDemoCameras();
        }

        this.errorMsg =
          'Modo demostración activo. Las cámaras se guardarán localmente.';
        this.loading = false;
      }
    });
  }

  selectCamera(camera: Camera): void {
    this.selectedCamera.set(camera);
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
    this.saveLocalCameras();
    this.closeCameraDialog();
  }

  private useDemoCameras(): void {
    this.cameras.set(this.demoCameras);
    this.selectedCamera.set(this.demoCameras[0]);
    this.saveLocalCameras();
  }

  private loadLocalCameras(): Camera[] {
    try {
      const content = localStorage.getItem(this.storageKey);

      if (!content) {
        return [];
      }

      const savedCameras = JSON.parse(content);

      if (!Array.isArray(savedCameras)) {
        return [];
      }

      /*
       * Reconoce tanto el modelo de develop como el utilizado
       * previamente por el frontend de demostración.
       */
      return savedCameras
        .map((camera: any) => ({
          id: String(camera.id),
          name: camera.name ?? camera.nombre,
          active: camera.active ?? camera.activa ?? true
        }))
        .filter((camera: Camera) => camera.id && camera.name);
    } catch {
      console.warn('No fue posible recuperar las cámaras guardadas.');
      return [];
    }
  }

  private saveLocalCameras(): void {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.cameras())
      );
    } catch {
      console.warn('No fue posible guardar las cámaras.');
    }
  }

  private mergeCameras(
    apiCameras: Camera[],
    localCameras: Camera[]
  ): Camera[] {
    const merged = [...apiCameras];

    localCameras.forEach(localCamera => {
      const exists = merged.some(
        camera =>
          camera.id === localCamera.id ||
          camera.name.toLocaleLowerCase('es') ===
          localCamera.name.toLocaleLowerCase('es')
      );

      if (!exists) {
        merged.push(localCamera);
      }
    });

    return merged;
  }

  private generateCameraId(): string {
    const cameraNumbers = this.cameras()
      .map(camera => Number(camera.id.replace(/\D/g, '')))
      .filter(number => Number.isFinite(number));

    const nextNumber = Math.max(...cameraNumbers, 0) + 1;

    return `CAM-${String(nextNumber).padStart(2, '0')}`;
  }
}