import { HttpEventType } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { Upload } from './upload';

/** PR-01 – Carga de video: URL prefirmada -> S3 -> notificación al backend (todo simulado). */
describe('Upload', () => {
  let api: Record<'getCameras' | 'requestVideoUploadUrl' | 'uploadVideoToS3' | 'notifyVideoUploaded', ReturnType<typeof vi.fn>>;

  const uploadData = {
    uploadUrl: 'https://bucket.s3.amazonaws.com/videos/x?sig=1',
    bucket: 'bucket',
    objectKey: 'videos/x.mp4',
    originalFileName: 'a.mp4',
    contentType: 'video/mp4',
    expiresAt: '2026-10-05T10:15:00Z',
  };
  const job = { jobId: 'job-1', originalFileName: 'a.mp4', bucket: 'bucket', objectKey: 'videos/x.mp4', cameraId: 'c1', status: 'QUEUED', createdAt: '2026-10-05T10:00:00Z' };
  const responseEvent = { type: HttpEventType.Response };

  const videoFile = () => new File(['x'], 'a.mp4', { type: 'video/mp4' });
  const fileEvent = (file: File | null) =>
    ({ target: { files: file ? [file] : [], value: 'C:\\fakepath\\x' } }) as unknown as Event;

  const create = () => {
    api.getCameras.mockReturnValue(of([{ id: 'c1', name: 'Entrada', active: true }]));
    const component = new Upload(api as any);
    component.ngOnInit();
    return component;
  };

  beforeEach(() => {
    api = {
      getCameras: vi.fn(),
      requestVideoUploadUrl: vi.fn(),
      uploadVideoToS3: vi.fn(),
      notifyVideoUploaded: vi.fn(),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe('cámaras', () => {
    it('carga las cámaras al iniciar', () => {
      const component = create();

      expect(component.cameras).toHaveLength(1);
      expect(component.loadingCameras).toBe(false);
      expect(component.error).toBe('');
    });

    it('si falla la carga muestra el error', () => {
      api.getCameras.mockReturnValue(throwError(() => new Error('x')));
      const component = new Upload(api as any);

      component.ngOnInit();

      expect(component.error).toContain('No se pudieron cargar las cámaras');
      expect(component.loadingCameras).toBe(false);
    });
  });

  describe('onFileSelected', () => {
    it('acepta un archivo de video', () => {
      const component = create();
      const file = videoFile();

      component.onFileSelected(fileEvent(file));

      expect(component.selectedFile).toBe(file);
      expect(component.error).toBe('');
    });

    it('rechaza un archivo que no es video y limpia el input', () => {
      const component = create();
      const event = fileEvent(new File(['x'], 'foto.png', { type: 'image/png' }));

      component.onFileSelected(event);

      expect(component.selectedFile).toBeNull();
      expect(component.error).toBe('Selecciona un archivo de video válido.');
      expect((event.target as HTMLInputElement).value).toBe('');
    });

    it('si no se elige nada deja selectedFile en null', () => {
      const component = create();
      component.selectedFile = videoFile();

      component.onFileSelected(fileEvent(null));

      expect(component.selectedFile).toBeNull();
    });

    it('al elegir otro archivo reinicia mensajes, progreso y job previo', () => {
      const component = create();
      component.success = 'ok';
      component.uploadProgress = 80;
      component.createdJob = job;

      component.onFileSelected(fileEvent(videoFile()));

      expect(component.success).toBe('');
      expect(component.uploadProgress).toBe(0);
      expect(component.createdJob).toBeNull();
    });
  });

  describe('uploadVideo', () => {
    it('exige elegir una cámara', () => {
      const component = create();
      component.selectedFile = videoFile();

      component.uploadVideo();

      expect(component.error).toBe('Selecciona una cámara.');
      expect(api.requestVideoUploadUrl).not.toHaveBeenCalled();
    });

    it('exige elegir un video', () => {
      const component = create();
      component.selectedCameraId = 'c1';

      component.uploadVideo();

      expect(component.error).toBe('Selecciona un video primero.');
      expect(api.requestVideoUploadUrl).not.toHaveBeenCalled();
      expect(component.uploading).toBe(false);
    });

    it('flujo completo: pide URL, sube a S3, notifica y deja el job creado', () => {
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(of(responseEvent));
      api.notifyVideoUploaded.mockReturnValue(of(job));
      const component = create();
      const file = videoFile();
      component.selectedCameraId = 'c1';
      component.selectedFile = file;

      component.uploadVideo();

      expect(api.requestVideoUploadUrl).toHaveBeenCalledWith({ fileName: 'a.mp4', contentType: 'video/mp4' });
      expect(api.uploadVideoToS3).toHaveBeenCalledWith(uploadData.uploadUrl, file);
      expect(api.notifyVideoUploaded).toHaveBeenCalledWith({
        originalFileName: 'a.mp4',
        bucket: 'bucket',
        objectKey: 'videos/x.mp4',
        cameraId: 'c1',
      });
      expect(component.createdJob).toEqual(job);
      expect(component.success).toBe('El video se subió correctamente y fue registrado en el backend.');
      expect(component.uploadProgress).toBe(100);
      expect(component.uploading).toBe(false);
      expect(component.error).toBe('');
    });

    it('actualiza el porcentaje de progreso mientras sube', () => {
      const s3$ = new Subject<any>();
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(s3$);
      const component = create();
      component.selectedCameraId = 'c1';
      component.selectedFile = videoFile();

      component.uploadVideo();
      s3$.next({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 });
      expect(component.uploadProgress).toBe(25);
      expect(component.uploading).toBe(true);

      s3$.next({ type: HttpEventType.UploadProgress, loaded: 200, total: 200 });
      expect(component.uploadProgress).toBe(100);
    });

    it('ignora eventos de progreso sin total', () => {
      const s3$ = new Subject<any>();
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(s3$);
      const component = create();
      component.selectedCameraId = 'c1';
      component.selectedFile = videoFile();

      component.uploadVideo();
      s3$.next({ type: HttpEventType.UploadProgress, loaded: 50, total: 0 });

      expect(component.uploadProgress).toBe(0);
    });

    it('si falla la URL prefirmada muestra el error y no sube nada', () => {
      api.requestVideoUploadUrl.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      component.selectedCameraId = 'c1';
      component.selectedFile = videoFile();

      component.uploadVideo();

      expect(component.error).toBe('No se pudo preparar la carga del video en AWS S3.');
      expect(component.uploading).toBe(false);
      expect(api.uploadVideoToS3).not.toHaveBeenCalled();
    });

    it('si falla la subida a S3 sugiere revisar CORS y no notifica al backend', () => {
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      component.selectedCameraId = 'c1';
      component.selectedFile = videoFile();

      component.uploadVideo();

      expect(component.error).toContain('CORS');
      expect(component.uploading).toBe(false);
      expect(api.notifyVideoUploaded).not.toHaveBeenCalled();
    });

    it('si falla la notificación, avisa que el video sí quedó en S3', () => {
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(of(responseEvent));
      api.notifyVideoUploaded.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      component.selectedCameraId = 'c1';
      component.selectedFile = videoFile();

      component.uploadVideo();

      expect(component.error).toBe('El video se subió a S3, pero no se pudo notificar al backend.');
      expect(component.createdJob).toBeNull();
      expect(component.uploading).toBe(false);
    });
  });
});
