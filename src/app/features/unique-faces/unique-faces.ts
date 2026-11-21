import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';

import { ApiService, Camera } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { UniqueFace } from '../../core/models/UniqueFace';
import { MarksService } from '../../shared/services/marks.service';
import { FaceAppearance } from '../../core/models/face.model';
import { DetectionDetailComponent } from '../../shared/components/detection-detail/detection-detail';
import { FreshnessTimer, IMAGES_MAX_AGE_MS } from '../../shared/utils/freshness-timer';

interface FaceQuery {
  startDate?: string;
  endDate?: string;
  hasReports?: boolean;
  suspect?: boolean;
}

@Component({
  selector: 'app-unique-faces',
  standalone: true,
  imports: [
    ImageFallbackDirective,
    CommonModule,
    FormsModule,
    DetectionDetailComponent
  ],
  templateUrl: './unique-faces.html',
  styleUrl: './unique-faces.css',
})
export class UniqueFaces implements OnInit, OnDestroy {

  faces = signal<UniqueFace[]>([]);
  cameras = signal<Camera[]>([]);
  camerasError = signal('');

  selected = signal<UniqueFace | null>(null);
  detailClosing = signal(false);

  openedMatch = signal<FaceAppearance | null>(null);
  private openMatchToken = 0;

  selectedAppearance = computed<FaceAppearance | null>(() => {
    const opened = this.openedMatch();

    if (opened) {
      return opened;
    }

    const face = this.selected();
    return face ? { ...face.appearances[0], faceId: face.faceId } : null;
  });

  loading = signal(false);

  loadError = signal('');


  startDate: string = '';

  endDate: string = '';

  hasReports: string = '';

  suspect: string = '';


  private requestToken = 0;
  private loadedAt = 0;
  private refreshing = false;
  private readonly freshness = new FreshnessTimer(() => this.refreshIfStale());
  private activeQuery: FaceQuery = {};

  constructor(private api: ApiService, private marks: MarksService) {}


  ngOnInit(): void {

    this.marks.load();
    this.loadFaces();
    this.freshness.start();
    this.api.getCameras().subscribe({
      next: (cameras) => this.cameras.set(cameras),
      error: (err) => {
        console.error('Error al cargar las cámaras', err);
        this.camerasError.set(
          apiErrorMessage(err, 'No se pudieron cargar las cámaras.')
        );
      }
    });

  }
  getCameraName(cameraId: string): string {
    return this.cameras().find(camera => camera.id === cameraId)?.name
      ?? 'Cámara no identificada';
  }


  ngOnDestroy(): void {
    this.freshness.stop();
    this.requestToken++;
  }




  isMarked(face: UniqueFace): boolean {
    return this.marks.loaded()
      ? this.marks.isMarked(face.faceId)
      : face.suspect;
  }


  loadFaces(): void {

    this.activeQuery = {
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      hasReports:
        this.hasReports === '' ? undefined : this.hasReports === 'true',
      suspect:
        this.suspect === '' ? undefined : this.suspect === 'true'
    };

    this.faces.set([]);
    this.loading.set(true);
    this.loadError.set('');

    this.fetchFaces(false);

  }


  private refreshFaces(): void {

    this.refreshing = true;

    this.fetchFaces(true);

  }


  private fetchFaces(keepCards: boolean): void {

    const token = ++this.requestToken;

    if (!keepCards) {

      this.refreshing = false;

    }

    const query = this.activeQuery;

    this.api.getUniqueFaces(
      query.startDate,
      query.endDate,
      query.hasReports,
      query.suspect
    ).subscribe({

      next: (data) => {

        if (token !== this.requestToken) {

          return;

        }

        this.refreshing = false;

        this.faces.set(data);
        this.loadedAt = Date.now();
        this.loading.set(false);

        const current = this.selected();

        if (keepCards && current) {

          this.selected.set(
            data.find(face => face.faceId === current.faceId) ?? current
          );

        }

      },

      error: (err) => {

        if (token !== this.requestToken) {

          return;

        }

        if (keepCards) {

          this.refreshing = false;

          return;

        }

        this.faces.set([]);
        this.loadError.set(
          apiErrorMessage(err, 'No se pudieron cargar las detecciones.')
        );
        this.loading.set(false);

      }

    });

  }


  private refreshIfStale(): void {

    const stale =
      !this.loading() &&
      !this.refreshing &&
      !this.loadError() &&
      Date.now() - this.loadedAt >= IMAGES_MAX_AGE_MS;

    if (stale) {

      this.refreshFaces();

    }

  }


  applyFilters(): void {

    this.clearOpenedMatch();
    this.selected.set(null);

    this.loadFaces();

  }


  clearFilters(): void {

    this.startDate = '';

    this.endDate = '';

    this.hasReports = '';

    this.suspect = '';

    this.clearOpenedMatch();
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
      this.clearOpenedMatch();
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
      this.clearOpenedMatch();
      this.detailClosing.set(false);

    }, 160);

  }

  openMatch(faceId: string): void {

    const token = ++this.openMatchToken;

    this.api.getFaceAppearancesByIds([faceId]).subscribe({
      next: appearances => {
        if (token === this.openMatchToken && appearances.length > 0) {
          this.openedMatch.set(appearances[0]);
        }
      },
      error: error => console.error('No se pudo abrir la detección', error)
    });

  }

  private clearOpenedMatch(): void {

    this.openMatchToken++;
    this.openedMatch.set(null);

  }

}
