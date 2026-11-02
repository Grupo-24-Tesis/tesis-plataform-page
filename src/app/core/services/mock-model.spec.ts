import { MockModelService } from './mock-model';

/** PR-01 – Servicio que simula el modelo de procesamiento. */
describe('MockModelService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resuelve tras 1200 ms con el nombre del video y dos clusters', async () => {
    const service = new MockModelService();
    const file = new File(['x'], 'camara1.mp4', { type: 'video/mp4' });

    const promise = service.processVideoMock(file);
    vi.advanceTimersByTime(1200);
    const result = await promise;

    expect(result.videoName).toBe('camara1.mp4');
    expect(result.clusters.map(c => c.clusterId)).toEqual(['person_001', 'person_002']);
    expect(result.clusters[0].appearances).toHaveLength(2);
    expect(result.clusters[1].appearances[0].cameraId).toBe('cam_2');
    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
  });

  it('no resuelve antes de 1200 ms', async () => {
    const service = new MockModelService();
    let resolved = false;

    service.processVideoMock(new File(['x'], 'a.mp4')).then(() => (resolved = true));
    vi.advanceTimersByTime(1199);
    await Promise.resolve();

    expect(resolved).toBe(false);
  });
});
