import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';

import { ApiService } from '../../../core/services/api.service';
import { apiErrorMessage } from '../../../core/services/api-error';
import { SessionService } from '../../../core/services/session.service';
import {
  DetectionMatches,
  MatchDecision,
  MatchDetection,
  MatchLink
} from '../../../core/models/face-match';
import { ImageFallbackDirective } from '../../directives/image-fallback.directive';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function similarityLabel(score: number | null): string {
  return score === null ? '' : `similitud ${score.toFixed(2).replace('.', ',')}`;
}

export function linkToDetection(links: MatchLink[], faceId: string): MatchLink | undefined {
  return links
    .filter(link => link.faceIdA === faceId || link.faceIdB === faceId)
    .reduce<MatchLink | undefined>(
      (latest, link) =>
        !latest || (link.createdAt ?? '') >= (latest.createdAt ?? '') ? link : latest,
      undefined
    );
}

@Component({
  selector: 'app-detection-matches',
  standalone: true,
  imports: [DatePipe, ImageFallbackDirective],
  templateUrl: './detection-matches.html',
  styleUrl: './detection-matches.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetectionMatchesComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  readonly faceId = input.required<string>();
  readonly openDetection = output<string>();
  readonly changed = output<void>();

  readonly confirmed = signal<DetectionMatches | null>(null);
  readonly confirmedState = signal<LoadState>('loading');
  readonly confirmedError = signal('');

  readonly candidates = signal<MatchDetection[]>([]);
  readonly candidatesState = signal<LoadState>('idle');
  readonly candidatesError = signal('');

  readonly busyKey = signal('');
  readonly actionError = signal('');

  readonly others = computed(() =>
    (this.confirmed()?.detections ?? []).filter(item => item.faceId !== this.faceId())
  );

  readonly rows = computed(() => {
    const matches = this.confirmed();
    return (matches?.detections ?? []).map(item => ({
      item,
      self: item.faceId === this.faceId(),
      link: linkToDetection(matches?.links ?? [], item.faceId)
    }));
  });

  private confirmedToken = 0;
  private candidatesToken = 0;

  constructor() {
    effect(() => {
      const faceId = this.faceId();
      untracked(() => {
        this.candidatesToken++;
        this.candidates.set([]);
        this.candidatesState.set('idle');
        this.candidatesError.set('');
        this.actionError.set('');
        this.busyKey.set('');
        this.loadConfirmed(faceId);
      });
    });
  }

  retryConfirmed(): void {
    this.loadConfirmed(this.faceId());
  }

  search(): void {
    if (this.candidatesState() === 'loading') {
      return;
    }

    const faceId = this.faceId();
    const token = ++this.candidatesToken;
    this.candidatesState.set('loading');
    this.candidatesError.set('');
    this.actionError.set('');

    this.api.getCandidates(faceId).subscribe({
      next: found => {
        if (token !== this.candidatesToken) {
          return;
        }

        this.candidates.set(found);
        this.candidatesState.set('ready');
      },
      error: error => {
        if (token !== this.candidatesToken) {
          return;
        }

        this.candidatesError.set(
          apiErrorMessage(error, 'No se pudieron buscar coincidencias.')
        );
        this.candidatesState.set('error');
      }
    });
  }

  decide(candidate: MatchDetection, decision: MatchDecision): void {
    if (this.busyKey()) {
      return;
    }

    const faceId = this.faceId();
    this.busyKey.set(`${decision}:${candidate.faceId}`);
    this.actionError.set('');

    this.api
      .decideMatch({
        faceIdA: faceId,
        faceIdB: candidate.faceId,
        decision,
        score: candidate.score,
        createdByGuardId: this.session.getActiveGuard()?.id
      })
      .subscribe({
        next: () => {
          if (faceId !== this.faceId()) {
            return;
          }

          this.busyKey.set('');
          this.candidates.update(list => list.filter(item => item.faceId !== candidate.faceId));

          if (decision === 'confirmada') {
            this.loadConfirmed(faceId);
          }

          this.changed.emit();
        },
        error: error => this.failAction(faceId, error, 'No se pudo guardar la decisión.')
      });
  }

  undo(link: MatchLink): void {
    if (this.busyKey()) {
      return;
    }

    const faceId = this.faceId();
    this.busyKey.set(`quitar:${link.id}`);
    this.actionError.set('');

    this.api.undoMatch(link.id).subscribe({
      next: () => {
        if (faceId !== this.faceId()) {
          return;
        }

        this.busyKey.set('');
        this.loadConfirmed(faceId);
        this.changed.emit();
      },
      error: error => this.failAction(faceId, error, 'No se pudo quitar la coincidencia.')
    });
  }

  isBusy(key: string): boolean {
    return this.busyKey() === key;
  }

  score(item: MatchDetection): string {
    return similarityLabel(item.score);
  }

  private failAction(faceId: string, error: unknown, fallback: string): void {
    if (faceId !== this.faceId()) {
      return;
    }

    this.busyKey.set('');
    this.session.endIfGuardMissing(error);
    this.actionError.set(apiErrorMessage(error, fallback));
  }

  private loadConfirmed(faceId: string): void {
    const token = ++this.confirmedToken;
    this.confirmedState.set('loading');
    this.confirmedError.set('');

    this.api.getDetectionMatches(faceId).subscribe({
      next: matches => {
        if (token !== this.confirmedToken) {
          return;
        }

        this.confirmed.set(matches);
        this.confirmedState.set('ready');
      },
      error: error => {
        if (token !== this.confirmedToken) {
          return;
        }

        this.confirmedError.set(
          apiErrorMessage(error, 'No se pudieron cargar las coincidencias.')
        );
        this.confirmedState.set('error');
      }
    });
  }
}
