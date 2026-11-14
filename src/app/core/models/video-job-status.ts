export type VideoStatusTone = 'pending' | 'ok' | 'error';

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'QUEUE_ERROR'];

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Registrado',
  QUEUED: 'En cola',
  PROCESSING: 'Procesando',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  QUEUE_ERROR: 'No se pudo enviar a la cola'
};

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function videoStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function videoStatusTone(status: string): VideoStatusTone {
  if (status === 'COMPLETED') {
    return 'ok';
  }

  if (status === 'FAILED' || status === 'QUEUE_ERROR') {
    return 'error';
  }

  return 'pending';
}
