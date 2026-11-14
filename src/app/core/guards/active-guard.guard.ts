import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const activeGuardGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  return session.getActiveGuard() ? true : router.createUrlTree(['/guards']);
};
