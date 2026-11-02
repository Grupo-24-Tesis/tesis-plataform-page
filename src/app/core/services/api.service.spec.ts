import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApiService } from './api.service';

const BASE = 'http://localhost:8080/api';

/** PR-01 – Servicio HTTP: URL, método, cuerpo y parámetros de cada llamada (sin backend real). */
describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Busca una petición por URL exacta (ignora los query params). */
  const expectUrl = (url: string) => http.expectOne(req => req.url === url);

  describe('guardias y cámaras', () => {
    it('getGuards hace GET /guards', () => {
      let result: unknown;
      api.getGuards().subscribe(r => (result = r));

      const req = http.expectOne(`${BASE}/guards`);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: '1', name: 'Ana', shift: 'noche', schedule: '22-06' }]);

      expect(result).toEqual([{ id: '1', name: 'Ana', shift: 'noche', schedule: '22-06' }]);
    });

    it('createGuard hace POST /guards con el cuerpo recibido', () => {
      const payload = { name: 'Ana', shift: 'Sin asignar', schedule: 'Horario no definido' };
      api.createGuard(payload).subscribe();

      const req = http.expectOne(`${BASE}/guards`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ id: '1', ...payload });
    });

    it('getCameras hace GET /cameras', () => {
      api.getCameras().subscribe();

      const req = http.expectOne(`${BASE}/cameras`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('createCamera hace POST /cameras', () => {
      api.createCamera({ name: 'Entrada', active: true }).subscribe();

      const req = http.expectOne(`${BASE}/cameras`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Entrada', active: true });
      req.flush({ id: 'c1', name: 'Entrada', active: true });
    });
  });

  describe('apariciones de caras', () => {
    it('getFaceAppearances hace GET /face-appearances', () => {
      api.getFaceAppearances().subscribe();

      const req = http.expectOne(`${BASE}/face-appearances`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('createFaceAppearance hace POST /face-appearances', () => {
      const payload = { faceId: 'f1', timestamp: '00:00:04', cameraId: 'c1' };
      api.createFaceAppearance(payload).subscribe();

      const req = http.expectOne(`${BASE}/face-appearances`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(payload);
    });

    it('getUniqueFaces sin filtros no envía parámetros', () => {
      api.getUniqueFaces().subscribe();

      const req = expectUrl(`${BASE}/face-appearances/unique`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('getUniqueFaces envía todos los filtros recibidos', () => {
      api.getUniqueFaces('2026-10-01', '2026-10-05', true, false).subscribe();

      const req = expectUrl(`${BASE}/face-appearances/unique`);
      expect(req.request.params.get('startDate')).toBe('2026-10-01');
      expect(req.request.params.get('endDate')).toBe('2026-10-05');
      expect(req.request.params.get('hasReports')).toBe('true');
      // false NO debe omitirse: es un filtro válido
      expect(req.request.params.get('suspect')).toBe('false');
      req.flush([]);
    });

    it('getUniqueFaces omite las fechas vacías', () => {
      api.getUniqueFaces('', '', undefined, true).subscribe();

      const req = expectUrl(`${BASE}/face-appearances/unique`);
      expect(req.request.params.has('startDate')).toBe(false);
      expect(req.request.params.has('endDate')).toBe(false);
      expect(req.request.params.has('hasReports')).toBe(false);
      expect(req.request.params.get('suspect')).toBe('true');
      req.flush([]);
    });
  });

  describe('reportes', () => {
    it('getReports hace GET /reports', () => {
      api.getReports().subscribe();

      const req = http.expectOne(`${BASE}/reports`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('getFilteredReports sin filtros no envía parámetros', () => {
      api.getFilteredReports().subscribe();

      const req = expectUrl(`${BASE}/reports/filter`);
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('getFilteredReports envía solo los filtros con valor', () => {
      api.getFilteredReports('solucionado', '2026-10-05', undefined, '', 'resolucion').subscribe();

      const req = expectUrl(`${BASE}/reports/filter`);
      expect(req.request.params.get('status')).toBe('solucionado');
      expect(req.request.params.get('date')).toBe('2026-10-05');
      expect(req.request.params.get('dateType')).toBe('resolucion');
      expect(req.request.params.has('startDate')).toBe(false);
      expect(req.request.params.has('endDate')).toBe(false);
      req.flush([]);
    });

    it('createReport hace POST /reports', () => {
      const report: any = { title: 'Robo', description: 'd', incidentDate: '2026-10-05T10:00', faceIds: [] };
      api.createReport(report).subscribe();

      const req = http.expectOne(`${BASE}/reports`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(report);
      req.flush(report);
    });

    it('updateReportStatus hace PUT /reports/{id}/status con estado y resolución', () => {
      api.updateReportStatus('r1', 'solucionado', '2026-10-06T12:00', 'Resuelto').subscribe();

      const req = http.expectOne(`${BASE}/reports/r1/status`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        status: 'solucionado',
        resolvedAt: '2026-10-06T12:00',
        resolutionDescription: 'Resuelto',
      });
      req.flush({});
    });

    it('updateReportStatus sin resolución solo envía el estado', () => {
      api.updateReportStatus('r1', 'investigacion').subscribe();

      const req = http.expectOne(`${BASE}/reports/r1/status`);
      expect(req.request.body.status).toBe('investigacion');
      expect(req.request.body.resolvedAt).toBeUndefined();
      req.flush({});
    });
  });

  describe('personas marcadas', () => {
    it('getMarked hace GET /marked', () => {
      api.getMarked().subscribe();

      const req = http.expectOne(`${BASE}/marked`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('createMarked hace POST /marked', () => {
      api.createMarked({ faceId: 'f1', reason: 'Sospechoso' }).subscribe();

      const req = http.expectOne(`${BASE}/marked`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ faceId: 'f1', reason: 'Sospechoso' });
      req.flush({ id: 'm1', faceId: 'f1', reason: 'Sospechoso' });
    });

    it('deleteMarked hace DELETE /marked/{id}', () => {
      api.deleteMarked('m1').subscribe();

      const req = http.expectOne(`${BASE}/marked/m1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('carga de video', () => {
    it('requestVideoUploadUrl hace POST /videos/upload-url', () => {
      api.requestVideoUploadUrl({ fileName: 'a.mp4', contentType: 'video/mp4' }).subscribe();

      const req = http.expectOne(`${BASE}/videos/upload-url`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ fileName: 'a.mp4', contentType: 'video/mp4' });
      req.flush({});
    });

    it('uploadVideoToS3 hace PUT a la URL prefirmada con el Content-Type del archivo', () => {
      const file = new File(['contenido'], 'a.mp4', { type: 'video/mp4' });
      api.uploadVideoToS3('https://bucket.s3.amazonaws.com/videos/x?sig=1', file).subscribe();

      const req = http.expectOne('https://bucket.s3.amazonaws.com/videos/x?sig=1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(file);
      expect(req.request.headers.get('Content-Type')).toBe('video/mp4');
      expect(req.request.reportProgress).toBe(true);
      req.flush('');
    });

    it('notifyVideoUploaded hace POST /videos', () => {
      const payload = { originalFileName: 'a.mp4', bucket: 'b', objectKey: 'k', cameraId: 'c1' };
      api.notifyVideoUploaded(payload).subscribe();

      const req = http.expectOne(`${BASE}/videos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });
  });

  it('propaga los errores HTTP al suscriptor', () => {
    let status = 0;
    api.getGuards().subscribe({ error: e => (status = e.status) });

    http.expectOne(`${BASE}/guards`).flush('error', { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
  });
});
