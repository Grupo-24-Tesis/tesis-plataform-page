import { HttpErrorResponse } from '@angular/common/http';

import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('returns the message sent by the backend', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { status: 400, message: 'El nombre de la camara ya existe' }
    });

    expect(apiErrorMessage(error, 'Respaldo')).toBe('El nombre de la camara ya existe');
  });

  it('returns the fallback for a plain error', () => {
    expect(apiErrorMessage(new Error('sin red'), 'Respaldo')).toBe('Respaldo');
    expect(apiErrorMessage(undefined, 'Respaldo')).toBe('Respaldo');
  });

  it('returns the fallback when the body is not JSON', () => {
    const textBody = new HttpErrorResponse({ status: 502, error: '<html>Bad Gateway</html>' });
    const emptyBody = new HttpErrorResponse({ status: 0, error: null });
    const noMessage = new HttpErrorResponse({ status: 500, error: { status: 500 } });

    expect(apiErrorMessage(textBody, 'Respaldo')).toBe('Respaldo');
    expect(apiErrorMessage(emptyBody, 'Respaldo')).toBe('Respaldo');
    expect(apiErrorMessage(noMessage, 'Respaldo')).toBe('Respaldo');
  });
});
