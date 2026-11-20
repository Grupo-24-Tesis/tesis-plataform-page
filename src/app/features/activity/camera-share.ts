import { ActivityCamera } from '../../core/models/activity.model';

export const MAX_SLICES = 6;
export const OTHERS_COLOR = 'var(--serie-otras)';
const OTHERS_NAME = 'Otras';

export interface CameraShare {
  key: string;
  cameraId: string | null;
  name: string;
  count: number;
  percent: number;
  color: string;
}

export interface ShareBar extends CameraShare {
  title: string;
}

export function seriesColor(slot: number): string {
  return `var(--serie-${slot})`;
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(1).replace('.', ',')} %`;
}

export function shareTitle(share: CameraShare): string {
  const noun = share.count === 1 ? 'detección' : 'detecciones';
  return `${share.name}: ${share.count} ${noun}, ${formatPercent(share.percent)}`;
}

function percentOf(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count * 1000) / total) / 10;
}

function orderedCameras(cameras: ActivityCamera[], cameraOrder: string[]): ActivityCamera[] {
  const position = new Map(cameraOrder.map((id, index) => [id, index]));
  const known = cameras
    .filter(camera => position.has(camera.cameraId))
    .sort((a, b) => position.get(a.cameraId)! - position.get(b.cameraId)!);
  const unknown = cameras
    .filter(camera => !position.has(camera.cameraId))
    .sort((a, b) => a.cameraName.localeCompare(b.cameraName, 'es'));
  return [...known, ...unknown];
}

export function cameraShares(cameras: ActivityCamera[], cameraOrder: string[]): CameraShare[] {
  const present = orderedCameras(cameras.filter(camera => camera.count > 0), cameraOrder);
  const total = present.reduce((sum, camera) => sum + camera.count, 0);

  if (total === 0) {
    return [];
  }

  let kept = present;
  let folded: ActivityCamera[] = [];

  if (present.length > MAX_SLICES) {
    const largest = new Set(
      [...present]
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_SLICES - 1)
        .map(camera => camera.cameraId)
    );
    kept = present.filter(camera => largest.has(camera.cameraId));
    folded = present.filter(camera => !largest.has(camera.cameraId));
  }

  const shares: CameraShare[] = kept.map((camera, index) => ({
    key: camera.cameraId,
    cameraId: camera.cameraId,
    name: camera.cameraName,
    count: camera.count,
    percent: percentOf(camera.count, total),
    color: seriesColor(index + 1)
  }));

  if (folded.length > 0) {
    const count = folded.reduce((sum, camera) => sum + camera.count, 0);
    shares.push({
      key: 'otras',
      cameraId: null,
      name: OTHERS_NAME,
      count,
      percent: percentOf(count, total),
      color: OTHERS_COLOR
    });
  }

  return shares;
}

export function rankedBars(shares: CameraShare[]): ShareBar[] {
  return [...shares]
    .sort((a, b) => b.count - a.count)
    .map(share => ({ ...share, title: shareTitle(share) }));
}

export function shareSummary(shares: CameraShare[]): string {
  if (shares.length === 0) {
    return 'Detecciones por cámara: no hay detecciones';
  }
  return `Detecciones por cámara: ${shares
    .map(share => `${share.name} ${formatPercent(share.percent)}`)
    .join(', ')}`;
}
