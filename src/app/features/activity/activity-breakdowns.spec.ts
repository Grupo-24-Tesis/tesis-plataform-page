import { ActivityVideo } from '../../core/models/activity.model';
import { MAX_VIDEO_BARS, followUpSegments, followUpSummary, videoBars, videoSummary } from './activity-breakdowns';
import { OTHERS_COLOR, seriesColor } from './camera-share';

function video(jobId: string, fileName: string, count: number, uploadedAt: string | null = null): ActivityVideo {
  return { jobId, fileName, count, uploadedAt };
}

describe('videoBars', () => {
  it('labels each video with its file name and upload date in one colour', () => {
    const bars = videoBars([
      video('a', 'P1E_S1_C2.mp4', 26, '2026-11-17T16:21:13.366Z'),
      video('b', 'Camera_ch6.mp4', 6)
    ]);

    expect(bars.map(bar => bar.label)).toEqual(['P1E_S1_C2.mp4 · 17/11/2026', 'Camera_ch6.mp4']);
    expect(bars.map(bar => bar.count)).toEqual([26, 6]);
    expect(bars.every(bar => bar.color === seriesColor(1))).toBe(true);
    expect(bars[0].title).toBe('P1E_S1_C2.mp4 · 17/11/2026: 26 detecciones');
  });

  it('keeps the ten largest and sums the rest into Otros', () => {
    const many = Array.from({ length: 13 }, (_, index) => video(`j${index}`, `v${index}.mp4`, 100 - index));
    const bars = videoBars(many);

    expect(bars.length).toBe(MAX_VIDEO_BARS + 1);
    expect(bars[9].label).toBe('v9.mp4');
    expect(bars[10].label).toBe('Otros (3 videos)');
    expect(bars[10].count).toBe(90 + 89 + 88);
    expect(bars[10].color).toBe(OTHERS_COLOR);
    expect(bars[10].jobId).toBeNull();
  });

  it('uses the singular for one remaining video and one detection', () => {
    const eleven = Array.from({ length: 11 }, (_, index) => video(`j${index}`, `v${index}.mp4`, index === 10 ? 1 : 50));
    const last = videoBars(eleven)[10];

    expect(last.label).toBe('Otros (1 video)');
    expect(last.title).toBe('Otros (1 video): 1 detección');
  });

  it('summarises the videos for screen readers', () => {
    expect(videoSummary(videoBars([video('a', 'P1E_S1_C2.mp4', 26)]))).toBe(
      'Detecciones por video: P1E_S1_C2.mp4 26'
    );
    expect(videoSummary([])).toBe('Detecciones por video: no hay detecciones');
  });
});

describe('followUpSegments', () => {
  const segments = followUpSegments({ investigation: 4, resolved: 2, markedOnly: 1, none: 74 }, 81);

  it('keeps the validated colour order with Spanish labels', () => {
    expect(segments.map(segment => segment.label)).toEqual([
      'Marcada sin reporte', 'Solucionado', 'En investigación', 'Sin seguimiento'
    ]);
    expect(segments.map(segment => segment.color)).toEqual([
      seriesColor(1), seriesColor(3), seriesColor(4), OTHERS_COLOR
    ]);
    expect(segments.map(segment => segment.count)).toEqual([1, 2, 4, 74]);
  });

  it('gives each group its share of the total with one decimal', () => {
    expect(segments.map(segment => segment.percent)).toEqual([1.2, 2.5, 4.9, 91.4]);
    expect(segments[2].title).toBe('En investigación: 4 detecciones, 4,9 %');
  });

  it('keeps empty groups with a zero share', () => {
    const empty = followUpSegments({ investigation: 0, resolved: 0, markedOnly: 0, none: 26 }, 26);

    expect(empty.length).toBe(4);
    expect(empty.map(segment => segment.percent)).toEqual([0, 0, 0, 100]);
  });

  it('summarises the follow-up for screen readers', () => {
    expect(followUpSummary(segments)).toBe(
      'Seguimiento de las detecciones: Marcada sin reporte 1,2 %, Solucionado 2,5 %, ' +
      'En investigación 4,9 %, Sin seguimiento 91,4 %'
    );
  });
});
