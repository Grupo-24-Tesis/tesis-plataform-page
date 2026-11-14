import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';

import { ApiService, Camera } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { UniqueFace } from '../../core/models/UniqueFace';

@Component({
  selector: 'app-unique-faces',
  standalone: true,
  imports: [
    ImageFallbackDirective,
    CommonModule,
    FormsModule
  ],
  templateUrl: './unique-faces.html',
  styleUrl: './unique-faces.css',
})
export class UniqueFaces implements OnInit {

  faces = signal<UniqueFace[]>([]);
  cameras = signal<Camera[]>([]);

  selected = signal<UniqueFace | null>(null);
  detailClosing = signal(false);

  loading = signal(false);

  loadError = signal('');


  startDate: string = '';

  endDate: string = '';

  hasReports: string = '';

  suspect: string = '';


  constructor(private api: ApiService) {}


  ngOnInit(): void {

    this.loadFaces();
        this.api.getCameras().subscribe({
      next: (cameras) => this.cameras.set(cameras),
      error: (err) => console.error('Error loading cameras', err)
    });

  }
  getCameraName(cameraId: string): string {
    return this.cameras().find(camera => camera.id === cameraId)?.name
      ?? 'Cámara no identificada';
  }


  loadFaces(): void {

    const reportsFilter =
      this.hasReports === ''
        ? undefined
        : this.hasReports === 'true';


    const suspectFilter =
      this.suspect === ''
        ? undefined
        : this.suspect === 'true';


    this.faces.set([]);
    this.loading.set(true);
    this.loadError.set('');

    this.api.getUniqueFaces(
      this.startDate || undefined,
      this.endDate || undefined,
      reportsFilter,
      suspectFilter
    ).subscribe({

      next: (data) => {

        this.faces.set(data);
        this.loading.set(false);

      },

      error: (err) => {

        this.faces.set([]);
        this.loadError.set(
          apiErrorMessage(err, 'No se pudieron cargar las personas.')
        );
        this.loading.set(false);

      }

    });

  }


  applyFilters(): void {

    this.selected.set(null);

    this.loadFaces();

  }


  clearFilters(): void {

    this.startDate = '';

    this.endDate = '';

    this.hasReports = '';

    this.suspect = '';

    this.selected.set(null);

    this.loadFaces();

  }


  selectFace(face: UniqueFace): void {

    if (
      this.selected()?.faceId === face.faceId
    ) {

      this.closeDetail();

    } else {

      this.detailClosing.set(false);
      this.selected.set(face);

    }

  }


  closeDetail(): void {

    if (this.detailClosing() || !this.selected()) {

      return;

    }

    this.detailClosing.set(true);

    window.setTimeout(() => {

      this.selected.set(null);
      this.detailClosing.set(false);

    }, 160);

  }

}
