import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ApiService, MarkedPerson } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { SessionService } from '../../core/services/session.service';

export interface MarkOutcome {
  message: string;
  error: boolean;
  marked: boolean;
}

@Injectable({ providedIn: 'root' })
export class MarksService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  readonly marks = signal<MarkedPerson[]>([]);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadError = signal('');

  private readonly markedIds = computed(
    () => new Set(this.marks().map(mark => mark.faceId))
  );

  private loadToken = 0;

  isMarked(faceId: string): boolean {
    return this.markedIds().has(faceId);
  }

  markFor(faceId: string): MarkedPerson | undefined {
    return this.marks().find(mark => mark.faceId === faceId);
  }

  load(): void {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.loadError.set('');

    this.api.getMarked().subscribe({
      next: marks => {
        if (token !== this.loadToken) {
          return;
        }

        this.marks.set(marks);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: error => {
        if (token !== this.loadToken) {
          return;
        }

        this.loadError.set(
          apiErrorMessage(error, 'No se pudieron cargar las marcas.')
        );
        this.loading.set(false);
      }
    });
  }

  create(faceId: string, reason: string): Observable<MarkedPerson> {
    const createdByGuardId = this.session.getActiveGuard()?.id;

    return this.api.createMarked({ faceId, reason, createdByGuardId }).pipe(
      tap({
        next: created => this.marks.update(marks => [...marks, created]),
        error: error => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.load();
            return;
          }

          this.session.endIfGuardMissing(error);
        }
      })
    );
  }

  remove(id: string): Observable<void> {
    return this.api.deleteMarked(id).pipe(
      tap(() => this.marks.update(marks => marks.filter(mark => mark.id !== id)))
    );
  }

  toggle(
    faceId: string,
    reason: string,
    done: (outcome: MarkOutcome) => void
  ): void {
    if (this.busy()) {
      return;
    }

    const existing = this.markFor(faceId);
    this.busy.set(true);

    if (existing?.id) {
      this.remove(existing.id).subscribe({
        next: () => {
          this.busy.set(false);
          done({ message: 'Marca eliminada.', error: false, marked: false });
        },
        error: error => {
          this.busy.set(false);
          done({
            message: apiErrorMessage(error, 'No se pudo quitar la marca.'),
            error: true,
            marked: true
          });
        }
      });
      return;
    }

    this.create(faceId, reason.trim() || 'Sin motivo').subscribe({
      next: () => {
        this.busy.set(false);
        done({ message: 'Detección marcada.', error: false, marked: true });
      },
      error: error => {
        this.busy.set(false);
        done({
          message: apiErrorMessage(error, 'No se pudo marcar la detección.'),
          error: true,
          marked: false
        });
      }
    });
  }
}
