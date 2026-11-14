import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { apiErrorMessage } from './api-error';

export interface ActiveGuard {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly key = 'activeGuard';
  private readonly legacyKey = 'facecluster-active-guard';
  private readonly missingGuardMessage = 'El vigilante no existe';
  private readonly router = inject(Router);

  readonly notice = signal('');

  setActiveGuard(guard: ActiveGuard): void {
    this.notice.set('');
    localStorage.setItem(
      this.key,
      JSON.stringify({ id: guard.id, name: guard.name })
    );
  }

  getActiveGuard(): ActiveGuard | null {
    const raw = localStorage.getItem(this.key);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);

      if (typeof parsed?.id === 'string' && parsed.id) {
        return { id: parsed.id, name: parsed.name ?? '' };
      }
    } catch {
      return null;
    }

    return null;
  }

  clearActiveGuard(): void {
    localStorage.removeItem(this.key);
    localStorage.removeItem(this.legacyKey);
  }

  endIfGuardMissing(error: unknown): boolean {
    if (
      !(error instanceof HttpErrorResponse) ||
      error.status !== 400 ||
      apiErrorMessage(error, '') !== this.missingGuardMessage
    ) {
      return false;
    }

    this.clearActiveGuard();
    this.notice.set(
      'El vigilante de la sesión ya no está registrado. Selecciona de nuevo el vigilante para continuar.'
    );
    void this.router.navigateByUrl('/guards');
    return true;
  }
}
