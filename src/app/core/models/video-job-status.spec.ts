import {
  isTerminalStatus,
  videoStatusLabel,
  videoStatusTone
} from './video-job-status';

describe('video job status', () => {
  it('treats completed, failed and queue error as terminal', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(isTerminalStatus('FAILED')).toBe(true);
    expect(isTerminalStatus('QUEUE_ERROR')).toBe(true);
  });

  it('keeps polling uploaded, queued and processing jobs', () => {
    expect(isTerminalStatus('UPLOADED')).toBe(false);
    expect(isTerminalStatus('QUEUED')).toBe(false);
    expect(isTerminalStatus('PROCESSING')).toBe(false);
  });

  it('labels every backend status in Spanish', () => {
    expect(videoStatusLabel('UPLOADED')).toBe('Registrado');
    expect(videoStatusLabel('QUEUED')).toBe('En cola');
    expect(videoStatusLabel('PROCESSING')).toBe('Procesando');
    expect(videoStatusLabel('COMPLETED')).toBe('Completado');
    expect(videoStatusLabel('FAILED')).toBe('Fallido');
    expect(videoStatusLabel('QUEUE_ERROR')).toBe('No se pudo enviar a la cola');
  });

  it('shows an unknown status as it comes', () => {
    expect(videoStatusLabel('OTRO')).toBe('OTRO');
  });

  it('maps statuses to a tone', () => {
    expect(videoStatusTone('COMPLETED')).toBe('ok');
    expect(videoStatusTone('FAILED')).toBe('error');
    expect(videoStatusTone('QUEUE_ERROR')).toBe('error');
    expect(videoStatusTone('PROCESSING')).toBe('pending');
  });
});
