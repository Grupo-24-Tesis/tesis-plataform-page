import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private key = 'activeGuard';

  setActiveGuard(guardId: string) {
    localStorage.setItem(this.key, guardId);
  }

  getActiveGuard(): string | null {
    return localStorage.getItem(this.key);
  }
}