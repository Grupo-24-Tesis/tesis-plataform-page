export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));

  if (seconds < 60) {
    return `${seconds} s`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;

    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function formatDetectionCount(count: number): string {
  return `${count} ${count === 1 ? 'detección' : 'detecciones'}`;
}

export function describeVideoTimings(timings: {
  queueWaitSeconds?: number | null;
  processingSeconds?: number | null;
  faceCount?: number | null;
}): string {
  const parts: string[] = [];

  if (timings.queueWaitSeconds != null) {
    parts.push(`En cola ${formatDuration(timings.queueWaitSeconds)}`);
  }

  if (timings.processingSeconds != null) {
    parts.push(`procesado en ${formatDuration(timings.processingSeconds)}`);
  }

  if (timings.faceCount != null) {
    parts.push(formatDetectionCount(timings.faceCount));
  }

  return parts.join(', ');
}
