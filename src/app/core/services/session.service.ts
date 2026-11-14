import { Injectable } from '@angular/core';

export interface ActiveGuard {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly key = 'activeGuard';
  private readonly legacyKey = 'facecluster-active-guard';

  setActiveGuard(guard: ActiveGuard): void {
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
}
