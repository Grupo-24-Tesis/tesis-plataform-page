import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ActivityResponse } from '../../core/models/activity.model';
import { ApiService, Camera } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { ActivityChartComponent } from './activity-chart';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [FormsModule, ActivityChartComponent],
  templateUrl: './activity.html',
  styleUrl: './activity.css',
})
export class Activity implements OnInit, OnDestroy {
  cameraId = '';
  startDate = '';
  endDate = '';

  cameras = signal<Camera[]>([]);
  camerasError = signal('');
  activity = signal<ActivityResponse | null>(null);
  loading = signal(false);
  loadError = signal('');

  hasActivity = computed(() => (this.activity()?.total ?? 0) > 0);

  private requestToken = 0;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadActivity();

    this.api.getCameras().subscribe({
      next: cameras => this.cameras.set(cameras),
      error: error =>
        this.camerasError.set(
          apiErrorMessage(error, 'No se pudieron cargar las cámaras.')
        ),
    });
  }

  ngOnDestroy(): void {
    this.requestToken++;
  }

  loadActivity(): void {
    const token = ++this.requestToken;
    this.loading.set(true);
    this.loadError.set('');

    this.api
      .getActivity(
        this.cameraId || undefined,
        this.startDate || undefined,
        this.endDate || undefined
      )
      .subscribe({
        next: data => {
          if (token !== this.requestToken) {
            return;
          }
          this.activity.set(data);
          this.loading.set(false);
        },
        error: error => {
          if (token !== this.requestToken) {
            return;
          }
          this.loadError.set(
            apiErrorMessage(error, 'No se pudo cargar la actividad.')
          );
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.loadActivity();
  }

  clearFilters(): void {
    this.cameraId = '';
    this.startDate = '';
    this.endDate = '';
    this.loadActivity();
  }
}
