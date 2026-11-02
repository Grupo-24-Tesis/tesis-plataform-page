import { ElementRef } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { MonitorComponent } from './monitor';
import { Camera } from '../../core/services/api.service';

const VIDEOS_KEY = 'facecluster-monitor-videos-v1';
const SAVED_KEY = 'facecluster-saved-clusters-v1';

/** PR-01 – Monitor de cámaras: cámaras, videos, detecciones guardadas y carga de video (API simulada). */
describe('MonitorComponent', () => {
  let api: Record<'getCameras' | 'createCamera' | 'requestVideoUploadUrl' | 'uploadVideoToS3' | 'notifyVideoUploaded', ReturnType<typeof vi.fn>>;
  let dialog: { showModal: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  const entrada: Camera = { id: 'c1', name: 'Entrada', active: true };
  const patio: Camera = { id: 'c2', name: 'Patio', active: true };

  const cluster = (clusterId: string, appearances = 1) => ({
    clusterId,
    appearances: Array.from({ length: appearances }, (_, i) => ({ faceId: `${clusterId}-f${i}`, timestamp: '00:00:0' + i, cameraId: 'c1' })),
  });
  const video = (id: string, cameraId = 'c1', clusters = [cluster('p1', 2), cluster('p2', 1)]) => ({
    id, cameraId, fileName: `${id}.mp4`, processedAt: '2026-10-05T10:00:00Z', status: 'COMPLETED', clusters,
  });

  const uploadData = { uploadUrl: 'https://s3/x', bucket: 'b', objectKey: 'videos/x.mp4', originalFileName: 'a.mp4', contentType: 'video/mp4', expiresAt: 'x' };
  const job = { jobId: 'job-1', originalFileName: 'a.mp4', bucket: 'b', objectKey: 'videos/x.mp4', cameraId: 'c1', status: 'QUEUED', createdAt: '2026-10-05T10:00:00Z' };

  const create = (cameras: Camera[] = [entrada, patio]) => {
    api.getCameras.mockReturnValue(of(cameras));
    const component = new MonitorComponent(api as any);
    const dialogRef = { nativeElement: dialog } as unknown as ElementRef<HTMLDialogElement>;
    component.cameraDialog = dialogRef;
    component.videoDialog = dialogRef;
    component.ngOnInit();
    return component;
  };

  const withVideoFile = (component: MonitorComponent) => {
    component.selectedFile = new File(['x'], 'a.mp4', { type: 'video/mp4' });
  };

  beforeEach(() => {
    localStorage.clear();
    api = {
      getCameras: vi.fn(), createCamera: vi.fn(), requestVideoUploadUrl: vi.fn(),
      uploadVideoToS3: vi.fn(), notifyVideoUploaded: vi.fn(),
    };
    dialog = { showModal: vi.fn(), close: vi.fn() };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe('ngOnInit', () => {
    it('carga las cámaras y selecciona la primera', () => {
      const component = create();

      expect(component.cameras()).toEqual([entrada, patio]);
      expect(component.selectedCamera()).toEqual(entrada);
      expect(component.loading).toBe(false);
    });

    it('sin cámaras no selecciona ninguna', () => {
      const component = create([]);

      expect(component.selectedCamera()).toBeNull();
    });

    it('si falla la API muestra el error', () => {
      api.getCameras.mockReturnValue(throwError(() => new Error('x')));
      const component = new MonitorComponent(api as any);

      component.ngOnInit();

      expect(component.errorMsg).toBe('No se pudieron cargar las cámaras.');
      expect(component.cameras()).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('recupera videos y detecciones guardadas de localStorage', () => {
      localStorage.setItem(VIDEOS_KEY, JSON.stringify([video('v1')]));
      localStorage.setItem(SAVED_KEY, JSON.stringify(['v1:p1']));

      const component = create();

      expect(component.videos()).toHaveLength(1);
      expect(component.savedClusterIds()).toEqual(['v1:p1']);
    });

    it('ignora datos locales dañados o que no son listas', () => {
      localStorage.setItem(VIDEOS_KEY, '{roto');
      localStorage.setItem(SAVED_KEY, JSON.stringify({ no: 'lista' }));

      const component = create();

      expect(component.videos()).toEqual([]);
      expect(component.savedClusterIds()).toEqual([]);
    });
  });

  describe('cámaras', () => {
    it('sortedCameras ordena por nombre sin distinguir mayúsculas', () => {
      const component = create([
        { id: '1', name: 'zeta', active: true },
        { id: '2', name: 'Alfa', active: true },
        { id: '3', name: 'beta', active: true },
      ]);

      expect(component.sortedCameras().map(c => c.name)).toEqual(['Alfa', 'beta', 'zeta']);
    });

    it('selectCamera cambia la cámara y cierra el detalle de cluster', () => {
      const component = create();
      component.selectedCluster.set({ video: video('v1'), cluster: cluster('p1') });

      component.selectCamera(patio);

      expect(component.selectedCamera()).toEqual(patio);
      expect(component.selectedCluster()).toBeNull();
    });

    it('openCameraDialog limpia el formulario y abre el diálogo', () => {
      const component = create();
      component.newCameraName = 'viejo';
      component.cameraErrorMsg = 'error';

      component.openCameraDialog();

      expect(component.newCameraName).toBe('');
      expect(component.cameraErrorMsg).toBe('');
      expect(dialog.showModal).toHaveBeenCalledOnce();
    });

    it('closeCameraDialog cierra y limpia', () => {
      const component = create();
      component.newCameraName = 'algo';

      component.closeCameraDialog();

      expect(dialog.close).toHaveBeenCalledOnce();
      expect(component.newCameraName).toBe('');
    });

    it.each(['', '   ', 'ab'])('addCamera rechaza el nombre "%s"', name => {
      const component = create();
      component.newCameraName = name;

      component.addCamera();

      expect(component.cameraErrorMsg).toBe('Escribe un nombre de al menos tres caracteres.');
      expect(api.createCamera).not.toHaveBeenCalled();
    });

    it('addCamera rechaza un nombre repetido (sin distinguir mayúsculas)', () => {
      const component = create();
      component.newCameraName = ' ENTRADA ';

      component.addCamera();

      expect(component.cameraErrorMsg).toBe('Ya existe una cámara con ese nombre.');
      expect(api.createCamera).not.toHaveBeenCalled();
    });

    it('addCamera crea la cámara activa, la selecciona y cierra el diálogo', () => {
      const nueva: Camera = { id: 'c3', name: 'Garaje Norte', active: true };
      api.createCamera.mockReturnValue(of(nueva));
      const component = create();
      component.newCameraName = '  Garaje    Norte ';

      component.addCamera();

      expect(api.createCamera).toHaveBeenCalledWith({ name: 'Garaje Norte', active: true });
      expect(component.cameras()).toContainEqual(nueva);
      expect(component.selectedCamera()).toEqual(nueva);
      expect(dialog.close).toHaveBeenCalled();
    });

    it('si la API falla al crear muestra el error', () => {
      api.createCamera.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      component.newCameraName = 'Garaje';

      component.addCamera();

      expect(component.cameraErrorMsg).toBe('No se pudo registrar la cámara.');
      expect(component.cameras()).toHaveLength(2);
    });
  });

  describe('clusters', () => {
    it('selectCluster selecciona; repetirlo lo deselecciona', () => {
      const component = create();
      const v = video('v1');

      component.selectCluster(v, v.clusters[0]);
      expect(component.selectedCluster()?.cluster.clusterId).toBe('p1');

      component.selectCluster(v, v.clusters[0]);
      expect(component.selectedCluster()).toBeNull();
    });

    it('el mismo clusterId en otro video es otra selección', () => {
      const component = create();
      const v1 = video('v1');
      const v2 = video('v2');
      component.selectCluster(v1, v1.clusters[0]);

      component.selectCluster(v2, v2.clusters[0]);

      expect(component.selectedCluster()?.video.id).toBe('v2');
    });

    it('closeClusterDetail limpia la selección', () => {
      const component = create();
      component.selectedCluster.set({ video: video('v1'), cluster: cluster('p1') });

      component.closeClusterDetail();

      expect(component.selectedCluster()).toBeNull();
    });

    it('toggleSavedCluster guarda y quita la detección, persistiendo en localStorage', () => {
      const component = create();
      const v = video('v1');

      component.toggleSavedCluster(v, v.clusters[0]);
      expect(component.isClusterSaved(v, v.clusters[0])).toBe(true);
      expect(component.isClusterSaved(v, v.clusters[1])).toBe(false);
      expect(JSON.parse(localStorage.getItem(SAVED_KEY)!)).toEqual(['v1:p1']);

      component.toggleSavedCluster(v, v.clusters[0]);
      expect(component.isClusterSaved(v, v.clusters[0])).toBe(false);
      expect(JSON.parse(localStorage.getItem(SAVED_KEY)!)).toEqual([]);
    });
  });

  describe('consultas por cámara', () => {
    it('getCameraVideos devuelve solo los videos de la cámara seleccionada', () => {
      localStorage.setItem(VIDEOS_KEY, JSON.stringify([video('v1', 'c1'), video('v2', 'c2'), video('v3', 'c1')]));
      const component = create();

      expect(component.getCameraVideos().map(v => v.id)).toEqual(['v1', 'v3']);
    });

    it('getCameraVideos sin cámara seleccionada devuelve lista vacía', () => {
      expect(create([]).getCameraVideos()).toEqual([]);
    });

    it('getCameraAppearanceCount suma las apariciones de todos los clusters de esa cámara', () => {
      // cada video: p1 (2 apariciones) + p2 (1) = 3
      localStorage.setItem(VIDEOS_KEY, JSON.stringify([video('v1', 'c1'), video('v2', 'c2'), video('v3', 'c1')]));
      const component = create();

      expect(component.getCameraAppearanceCount('c1')).toBe(6);
      expect(component.getCameraAppearanceCount('c2')).toBe(3);
      expect(component.getCameraAppearanceCount('otra')).toBe(0);
    });
  });

  describe('diálogo de video', () => {
    it('openVideoDialog no abre sin cámara seleccionada', () => {
      const component = create([]);

      component.openVideoDialog();

      expect(dialog.showModal).not.toHaveBeenCalled();
    });

    it('openVideoDialog reinicia el estado y abre el diálogo', () => {
      const component = create();
      withVideoFile(component);
      component.videoErrorMsg = 'error';
      component.uploadProgress = 50;

      component.openVideoDialog();

      expect(component.selectedFile).toBeNull();
      expect(component.videoErrorMsg).toBe('');
      expect(component.uploadProgress).toBe(0);
      expect(dialog.showModal).toHaveBeenCalledOnce();
    });

    it('closeVideoDialog no cierra mientras se está procesando', () => {
      const component = create();
      component.processingVideo = true;

      component.closeVideoDialog();

      expect(dialog.close).not.toHaveBeenCalled();
    });

    it('closeVideoDialog cierra y limpia cuando no hay proceso activo', () => {
      const component = create();
      withVideoFile(component);

      component.closeVideoDialog();

      expect(dialog.close).toHaveBeenCalledOnce();
      expect(component.selectedFile).toBeNull();
    });
  });

  describe('onFileSelected', () => {
    const event = (file: File | null) =>
      ({ target: { files: file ? [file] : [], value: 'x' } }) as unknown as Event;

    it('acepta un video', () => {
      const component = create();
      const file = new File(['x'], 'a.mp4', { type: 'video/mp4' });

      component.onFileSelected(event(file));

      expect(component.selectedFile).toBe(file);
    });

    it('rechaza un archivo que no es video', () => {
      const component = create();

      component.onFileSelected(event(new File(['x'], 'a.pdf', { type: 'application/pdf' })));

      expect(component.selectedFile).toBeNull();
      expect(component.videoErrorMsg).toBe('Selecciona un archivo de video válido.');
    });

    it('sin archivo deja selectedFile en null', () => {
      const component = create();
      withVideoFile(component);

      component.onFileSelected(event(null));

      expect(component.selectedFile).toBeNull();
    });
  });

  describe('processVideo', () => {
    it('exige una cámara seleccionada', () => {
      const component = create([]);
      withVideoFile(component);

      component.processVideo();

      expect(component.videoErrorMsg).toBe('Selecciona una cámara.');
      expect(api.requestVideoUploadUrl).not.toHaveBeenCalled();
    });

    it('exige un video seleccionado', () => {
      const component = create();

      component.processVideo();

      expect(component.videoErrorMsg).toBe('Selecciona un video primero.');
      expect(component.processingVideo).toBe(false);
    });

    it('flujo completo: agrega el video a la cámara y lo persiste', () => {
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(of({ type: HttpEventType.Response }));
      api.notifyVideoUploaded.mockReturnValue(of(job));
      const component = create();
      withVideoFile(component);

      component.processVideo();

      expect(api.notifyVideoUploaded).toHaveBeenCalledWith({
        originalFileName: 'a.mp4', bucket: 'b', objectKey: 'videos/x.mp4', cameraId: 'c1',
      });
      const added = component.videos()[0];
      expect(added).toMatchObject({ id: 'job-1', jobId: 'job-1', cameraId: 'c1', fileName: 'a.mp4', status: 'QUEUED', clusters: [] });
      expect(JSON.parse(localStorage.getItem(VIDEOS_KEY)!)[0].id).toBe('job-1');
      expect(component.videoSuccessMsg).toBe('Video subido a S3 y registrado correctamente.');
      expect(component.processingVideo).toBe(false);
      expect(component.uploadProgress).toBe(100);
    });

    it('el video nuevo queda primero en la lista', () => {
      localStorage.setItem(VIDEOS_KEY, JSON.stringify([video('viejo')]));
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(of({ type: HttpEventType.Response }));
      api.notifyVideoUploaded.mockReturnValue(of(job));
      const component = create();
      withVideoFile(component);

      component.processVideo();

      expect(component.videos().map(v => v.id)).toEqual(['job-1', 'viejo']);
    });

    it('actualiza el progreso de subida', () => {
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(of({ type: HttpEventType.UploadProgress, loaded: 30, total: 120 }));
      const component = create();
      withVideoFile(component);

      component.processVideo();

      expect(component.uploadProgress).toBe(25);
      expect(component.processingVideo).toBe(true);
    });

    it('si falla la URL prefirmada muestra el error', () => {
      api.requestVideoUploadUrl.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      withVideoFile(component);

      component.processVideo();

      expect(component.videoErrorMsg).toBe('No se pudo preparar la carga del video.');
      expect(component.processingVideo).toBe(false);
    });

    it('si falla S3 sugiere revisar CORS y no notifica', () => {
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      withVideoFile(component);

      component.processVideo();

      expect(component.videoErrorMsg).toContain('CORS');
      expect(api.notifyVideoUploaded).not.toHaveBeenCalled();
      expect(component.processingVideo).toBe(false);
    });

    it('si falla la notificación avisa que el video sí quedó en S3 y no lo agrega', () => {
      api.requestVideoUploadUrl.mockReturnValue(of(uploadData));
      api.uploadVideoToS3.mockReturnValue(of({ type: HttpEventType.Response }));
      api.notifyVideoUploaded.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      withVideoFile(component);

      component.processVideo();

      expect(component.videoErrorMsg).toContain('se subió a S3');
      expect(component.videos()).toEqual([]);
      expect(component.processingVideo).toBe(false);
    });
  });
});
