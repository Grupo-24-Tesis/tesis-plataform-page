import { ActivityFollowUp, ActivityVideo } from '../../core/models/activity.model';
import { OTHERS_COLOR, formatPercent, seriesColor } from './camera-share';

export const MAX_VIDEO_BARS = 10;

export interface VideoBar {
  key: string;
  jobId: string | null;
  label: string;
  count: number;
  color: string;
  title: string;
}

export interface FollowUpSegment {
  key: keyof ActivityFollowUp;
  label: string;
  count: number;
  percent: number;
  color: string;
  title: string;
}

const FOLLOW_UP_GROUPS: { key: keyof ActivityFollowUp; label: string; color: string }[] = [
  { key: 'markedOnly', label: 'Marcada sin reporte', color: seriesColor(1) },
  { key: 'resolved', label: 'Solucionado', color: seriesColor(3) },
  { key: 'investigation', label: 'En investigación', color: seriesColor(4) },
  { key: 'none', label: 'Sin seguimiento', color: OTHERS_COLOR }
];

export function detectionsText(count: number): string {
  return `${count} ${count === 1 ? 'detección' : 'detecciones'}`;
}

function uploadDate(uploadedAt: string | null): string {
  if (!uploadedAt) {
    return '';
  }
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function videoLabel(video: ActivityVideo): string {
  const date = uploadDate(video.uploadedAt);
  return date ? `${video.fileName} · ${date}` : video.fileName;
}

export function videoBars(videos: ActivityVideo[]): VideoBar[] {
  const ranked = [...videos].filter(video => video.count > 0).sort((a, b) => b.count - a.count);
  const kept = ranked.slice(0, MAX_VIDEO_BARS);
  const rest = ranked.slice(MAX_VIDEO_BARS);

  const bars: VideoBar[] = kept.map(video => {
    const label = videoLabel(video);
    return {
      key: video.jobId,
      jobId: video.jobId,
      label,
      count: video.count,
      color: seriesColor(1),
      title: `${label}: ${detectionsText(video.count)}`
    };
  });

  if (rest.length > 0) {
    const count = rest.reduce((sum, video) => sum + video.count, 0);
    const label = `Otros (${rest.length} ${rest.length === 1 ? 'video' : 'videos'})`;
    bars.push({
      key: 'otros',
      jobId: null,
      label,
      count,
      color: OTHERS_COLOR,
      title: `${label}: ${detectionsText(count)}`
    });
  }

  return bars;
}

export function videoSummary(bars: VideoBar[]): string {
  if (bars.length === 0) {
    return 'Detecciones por video: no hay detecciones';
  }
  return `Detecciones por video: ${bars.map(bar => `${bar.label} ${bar.count}`).join(', ')}`;
}

export function followUpSegments(followUp: ActivityFollowUp, total: number): FollowUpSegment[] {
  return FOLLOW_UP_GROUPS.map(group => {
    const count = followUp?.[group.key] ?? 0;
    const percent = total > 0 ? Math.round((count * 1000) / total) / 10 : 0;
    return {
      key: group.key,
      label: group.label,
      count,
      percent,
      color: group.color,
      title: `${group.label}: ${detectionsText(count)}, ${formatPercent(percent)}`
    };
  });
}

export function followUpSummary(segments: FollowUpSegment[]): string {
  return `Seguimiento de las detecciones: ${segments
    .map(segment => `${segment.label} ${formatPercent(segment.percent)}`)
    .join(', ')}`;
}
