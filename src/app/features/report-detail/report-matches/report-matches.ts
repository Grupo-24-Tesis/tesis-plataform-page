import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked
} from '@angular/core';

import { ApiService } from '../../../core/services/api.service';
import { apiErrorMessage } from '../../../core/services/api-error';
import { MatchDetection } from '../../../core/models/face-match';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';

type LoadState = 'loading' | 'ready' | 'error';

function sortKey(item: MatchDetection): string {
  return `${item.capturedAt ?? ''}|${item.timestamp}`;
}

@Component({
  selector: 'app-report-matches',
  standalone: true,
  imports: [DatePipe, ImageFallbackDirective],
  templateUrl: './report-matches.html',
  styleUrl: './report-matches.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportMatchesComponent {
  private readonly api = inject(ApiService);

  readonly faceId = input.required<string>();

  readonly state = signal<LoadState>('loading');
  readonly error = signal('');
  readonly detections = signal<MatchDetection[]>([]);

  readonly others = computed(() =>
    this.detections()
      .filter(item => item.faceId !== this.faceId())
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  );

  private token = 0;

  constructor() {
    effect(() => {
      const faceId = this.faceId();
      untracked(() => this.load(faceId));
    });
  }

  retry(): void {
    this.load(this.faceId());
  }

  private load(faceId: string): void {
    const token = ++this.token;
    this.state.set('loading');
    this.error.set('');

    this.api.getDetectionMatches(faceId).subscribe({
      next: matches => {
        if (token !== this.token) {
          return;
        }

        this.detections.set(matches.detections);
        this.state.set('ready');
      },
      error: error => {
        if (token !== this.token) {
          return;
        }

        this.error.set(apiErrorMessage(error, 'No se pudieron cargar las coincidencias.'));
        this.state.set('error');
      }
    });
  }
}
