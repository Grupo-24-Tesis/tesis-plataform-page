import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService, MarkedPerson } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';

export interface MarkOutcome {
  message: string;
  error: boolean;
  marked: boolean;
}

@Injectable({ providedIn: 'root' })
export class MarksService {
  private readonly api = inject(ApiService);

  readonly marks = signal<MarkedPerson[]>([]);
  readonly busy = signal(false);
  readonly loadError = signal('');

  load(): void {
    this.api.getMarked().subscribe({
      next: marks => {
        this.marks.set(marks);
        this.loadError.set('');
      },
      error: error => {
        this.loadError.set(
          apiErrorMessage(error, 'No se pudieron cargar las marcas.')
        );
      }
    });
  }

  markFor(faceId: string): MarkedPerson | undefined {
    return this.marks().find(mark => mark.faceId === faceId);
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

    if (existing?.id) {
      this.remove(existing.id, done);
      return;
    }

    this.add(faceId, reason, done);
  }

  private add(
    faceId: string,
    reason: string,
    done: (outcome: MarkOutcome) => void
  ): void {
    this.busy.set(true);

    this.api.createMarked({
      faceId,
      reason: reason.trim() || 'Sin motivo'
    }).subscribe({
      next: created => {
        this.marks.update(marks => [...marks, created]);
        this.busy.set(false);
        done({ message: 'Detección marcada.', error: false, marked: true });
      },
      error: error => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.load();
        }

        this.busy.set(false);
        done({
          message: apiErrorMessage(error, 'No se pudo marcar la detección.'),
          error: true,
          marked: false
        });
      }
    });
  }

  private remove(id: string, done: (outcome: MarkOutcome) => void): void {
    this.busy.set(true);

    this.api.deleteMarked(id).subscribe({
      next: () => {
        this.marks.update(marks => marks.filter(mark => mark.id !== id));
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
  }
}
