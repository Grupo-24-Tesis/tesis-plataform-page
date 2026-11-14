import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService, Camera, Guard } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { ReportItem } from '../../core/models/report.model';
import { FaceAppearance } from '../../core/models/face.model';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { FreshnessTimer, IMAGES_MAX_AGE_MS } from '../../shared/utils/freshness-timer';

const BY_IDS_LIMIT = 50;

interface InvolvedDetection {
  faceId: string;
  appearance: FaceAppearance | undefined;
}

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [DatePipe, ImageFallbackDirective],
  templateUrl: './report-detail.html',
  styleUrl: './report-detail.css'
})
export class ReportDetail implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly report = signal<ReportItem | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly guards = signal<Guard[]>([]);
  readonly cameras = signal<Camera[]>([]);
  readonly appearances = signal<FaceAppearance[]>([]);
  readonly appearancesLoading = signal(false);
  readonly appearancesError = signal('');

  readonly authorName = computed(() => {
    const guardId = this.report()?.createdByGuardId;

    if (!guardId) {
      return 'Sin registro';
    }

    return this.guards().find(guard => guard.id === guardId)?.name ?? 'Sin registro';
  });

  readonly detections = computed<InvolvedDetection[]>(() => {
    const byFaceId = new Map(
      this.appearances().map(appearance => [appearance.faceId, appearance])
    );

    return (this.report()?.faceIds ?? []).map(faceId => ({
      faceId,
      appearance: byFaceId.get(faceId)
    }));
  });

  private reportToken = 0;
  private appearancesToken = 0;
  private appearancesLoadedAt = 0;
  private appearancesRefreshing = false;
  private readonly freshness = new FreshnessTimer(() => this.refreshIfStale());

  ngOnInit(): void {
    this.loadReport();
    this.freshness.start();

    this.api.getGuards().subscribe({
      next: guards => this.guards.set(guards),
      error: () => this.guards.set([])
    });

    this.api.getCameras().subscribe({
      next: cameras => this.cameras.set(cameras),
      error: () => this.cameras.set([])
    });
  }

  ngOnDestroy(): void {
    this.freshness.stop();
    this.reportToken++;
    this.appearancesToken++;
  }

  loadReport(): void {
    const token = ++this.reportToken;
    this.loading.set(true);
    this.loadError.set('');

    const id = this.route.snapshot.paramMap.get('id') ?? '';

    this.api.getReport(id).subscribe({
      next: report => {
        if (token !== this.reportToken) {
          return;
        }

        this.report.set(report);
        this.loading.set(false);
        this.loadAppearances(false);
      },
      error: error => {
        if (token !== this.reportToken) {
          return;
        }

        this.report.set(null);
        this.loadError.set(apiErrorMessage(error, 'No se pudo cargar el reporte.'));
        this.loading.set(false);
      }
    });
  }

  loadAppearances(keepCurrent: boolean): void {
    const faceIds = this.report()?.faceIds ?? [];

    if (faceIds.length === 0) {
      return;
    }

    const token = ++this.appearancesToken;
    this.appearancesRefreshing = keepCurrent;

    if (!keepCurrent) {
      this.appearances.set([]);
      this.appearancesLoading.set(true);
    }

    this.appearancesError.set('');

    const chunks: string[][] = [];

    for (let index = 0; index < faceIds.length; index += BY_IDS_LIMIT) {
      chunks.push(faceIds.slice(index, index + BY_IDS_LIMIT));
    }

    forkJoin(chunks.map(chunk => this.api.getFaceAppearancesByIds(chunk))).subscribe({
      next: results => {
        if (token !== this.appearancesToken) {
          return;
        }

        this.appearancesRefreshing = false;
        this.appearancesLoadedAt = Date.now();
        this.appearances.set(results.flat());
        this.appearancesLoading.set(false);
      },
      error: error => {
        if (token !== this.appearancesToken) {
          return;
        }

        this.appearancesRefreshing = false;
        this.appearancesLoading.set(false);

        if (keepCurrent) {
          return;
        }

        this.appearancesError.set(
          apiErrorMessage(error, 'No se pudieron cargar las detecciones.')
        );
      }
    });
  }

  cameraLabel(cameraId: string): string {
    return this.cameras().find(camera => camera.id === cameraId)?.name ?? cameraId;
  }

  back(): void {
    void this.router.navigate(['/reports']);
  }

  print(): void {
    window.print();
  }

  private refreshIfStale(): void {
    const stale =
      !!this.report() &&
      !this.appearancesLoading() &&
      !this.appearancesRefreshing &&
      !this.appearancesError() &&
      this.appearancesLoadedAt > 0 &&
      Date.now() - this.appearancesLoadedAt >= IMAGES_MAX_AGE_MS;

    if (stale) {
      this.loadAppearances(true);
    }
  }
}
