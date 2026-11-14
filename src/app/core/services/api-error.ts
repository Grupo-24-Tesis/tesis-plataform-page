import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body: unknown = error.error;

  if (typeof body !== 'object' || body === null) {
    return fallback;
  }

  const message = (body as { message?: unknown }).message;

  return typeof message === 'string' && message.trim() ? message : fallback;
}
