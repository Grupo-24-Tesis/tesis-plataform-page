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

import { catchError, forkJoin, map, of } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { apiErrorMessage } from '../../../core/services/api-error';
import { SessionService } from '../../../core/services/session.service';
import {
  DetectionMatches,
  DiscardedMatch,
  MatchDecision,
  MatchDetection,
  MatchLink
} from '../../../core/models/face-match';
import { ImageFallbackDirective } from '../../directives/image-fallback.directive';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function similarityLabel(score: number | null): string {
  return score === null ? '' : `similitud ${score.toFixed(2).replace('.', ',')}`;
}

export function linksOfDetection(links: MatchLink[], faceId: string): MatchLink[] {
  return links.filter(link => link.faceIdA === faceId || link.faceIdB === faceId);
}

export function linksToRemove(links: MatchLink[], viewed: string, removed: string): MatchLink[] {
  const adjacency = new Map<string, string[]>();

  for (const link of links) {
    if (link.faceIdA === removed || link.faceIdB === removed) {
      continue;
    }

    adjacency.set(link.faceIdA, [...(adjacency.get(link.faceIdA) ?? []), link.faceIdB]);
    adjacency.set(link.faceIdB, [...(adjacency.get(link.faceIdB) ?? []), link.faceIdA]);
  }

  const reachable = new Set<string>([viewed]);
  const queue = [viewed];

  while (queue.length > 0) {
    for (const next of adjacency.get(queue.shift()!) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  return linksOfDetection(links, removed).filter(link =>
    reachable.has(link.faceIdA === removed ? link.faceIdB : link.faceIdA)
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

  readonly discardedOpen = signal(false);

  readonly busyKey = signal('');
  readonly actionError = signal('');

  readonly others = computed(() =>
    (this.confirmed()?.detections ?? []).filter(item => item.faceId !== this.faceId())
  );

  readonly discarded = computed(() => this.confirmed()?.discarded ?? []);

  readonly rows = computed(() => {
    const matches = this.confirmed();
    return (matches?.detections ?? []).map(item => ({
      item,
      self: item.faceId === this.faceId(),
      links: linksOfDetection(matches?.links ?? [], item.faceId)
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
        this.discardedOpen.set(false);
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

  toggleDiscarded(): void {
    this.discardedOpen.update(open => !open);
  }

  restore(discard: DiscardedMatch): void {
    if (this.busyKey()) {
      return;
    }

    const viewed = this.faceId();
    this.busyKey.set(`restaurar:${discard.id}`);
    this.actionError.set('');

    this.api.undoMatch(discard.id).subscribe({
      next: () => {
        if (viewed !== this.faceId()) {
          return;
        }

        this.busyKey.set('');
        this.loadConfirmed(viewed);
        this.changed.emit();
      },
      error: error => this.failAction(viewed, error, 'No se pudo restaurar la detección.')
    });
  }

  undo(faceId: string): void {
    const viewed = this.faceId();
    const links = linksToRemove(this.confirmed()?.links ?? [], viewed, faceId);

    if (this.busyKey() || links.length === 0) {
      return;
    }

    this.busyKey.set(`quitar:${faceId}`);
    this.actionError.set('');

    forkJoin(
      links.map(link =>
        this.api.undoMatch(link.id).pipe(
          map(() => null),
          catchError(error => of(error))
        )
      )
    ).subscribe(results => {
      if (viewed !== this.faceId()) {
        return;
      }

      const failure = results.find(result => result !== null);
      this.busyKey.set('');

      if (failure) {
        this.session.endIfGuardMissing(failure);
        this.actionError.set(apiErrorMessage(failure, 'No se pudo quitar la coincidencia.'));
      }

      this.loadConfirmed(viewed);
      this.changed.emit();
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
