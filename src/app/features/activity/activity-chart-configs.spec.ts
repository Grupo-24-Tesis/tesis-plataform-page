import { TooltipItem } from 'chart.js';

import { ActivityCamera, ActivityHour } from '../../core/models/activity.model';
import { followUpSegments, videoBars } from './activity-breakdowns';
import {
  cameraBarConfig,
  cameraPieConfig,
  followUpConfig,
  hourBarConfig,
  videoBarConfig
} from './activity-chart-configs';
import { cameraShares } from './camera-share';

const CAMERAS: ActivityCamera[] = [
  { cameraId: 'c0', cameraName: 'Entrada Principal', count: 26 },
  { cameraId: 'c2', cameraName: 'Zona Común Piscina', count: 25 },
  { cameraId: 'c1', cameraName: 'Parqueadero A', count: 24 },
  { cameraId: 'c9', cameraName: 'Torre 1', count: 6 }
];
const ORDER = ['c0', 'c1', 'c9', 'c2'];
const resolve = (value: string) => `resuelto(${value})`;

function tooltipFor<T extends 'pie' | 'bar'>(dataIndex: number): TooltipItem<T> {
  return { dataIndex } as TooltipItem<T>;
}

describe('cameraPieConfig', () => {
  const shares = cameraShares(CAMERAS, ORDER);
  const config = cameraPieConfig(shares, resolve);

  it('is a pie with one slice per camera in colour order', () => {
    expect(config.type).toBe('pie');
    expect(config.data.labels).toEqual([
      'Entrada Principal', 'Parqueadero A', 'Torre 1', 'Zona Común Piscina'
    ]);
    expect(config.data.datasets[0].data).toEqual([26, 24, 6, 25]);
    expect(config.data.datasets[0].backgroundColor).toEqual([
      'resuelto(var(--serie-1))', 'resuelto(var(--serie-2))',
      'resuelto(var(--serie-3))', 'resuelto(var(--serie-4))'
    ]);
    expect(config.data.datasets[0].borderColor).toBe('resuelto(var(--superficie))');
    expect(config.data.datasets[0].borderWidth).toBe(2);
  });

  it('keeps the legend on top and shows the title', () => {
    expect(config.options?.responsive).toBe(true);
    expect(config.options?.plugins?.legend?.position).toBe('top');
    expect(config.options?.plugins?.title?.display).toBe(true);
    expect(config.options?.plugins?.title?.text).toBe('Porcentaje de detecciones por cámara');
  });

  it('writes the count and share in the tooltip', () => {
    const label = config.options?.plugins?.tooltip?.callbacks?.label as (item: TooltipItem<'pie'>) => string;

    expect(label(tooltipFor<'pie'>(2))).toBe('6 detecciones, 7,4 %');
  });
});

describe('cameraBarConfig', () => {
  const config = cameraBarConfig(cameraShares(CAMERAS, ORDER), resolve);

  it('draws horizontal bars ranked by count, each in its camera colour', () => {
    expect(config.type).toBe('bar');
    expect(config.options?.indexAxis).toBe('y');
    expect(config.data.labels).toEqual([
      'Entrada Principal', 'Zona Común Piscina', 'Parqueadero A', 'Torre 1'
    ]);
    expect(config.data.datasets[0].data).toEqual([26, 25, 24, 6]);
    expect(config.data.datasets[0].backgroundColor).toEqual([
      'resuelto(var(--serie-1))', 'resuelto(var(--serie-4))',
      'resuelto(var(--serie-2))', 'resuelto(var(--serie-3))'
    ]);
    expect(config.data.datasets[0].borderRadius).toBe(4);
  });

  it('hides the single-entry legend, shows the title and counts from zero in whole numbers', () => {
    expect(config.options?.plugins?.legend?.display).toBe(false);
    expect(config.options?.plugins?.title?.text).toBe('Detecciones por cámara');
    const x = config.options?.scales?.['x'] as { beginAtZero?: boolean; ticks?: { precision?: number } };
    expect(x.beginAtZero).toBe(true);
    expect(x.ticks?.precision).toBe(0);
  });

  it('writes the count and share in the tooltip', () => {
    const label = config.options?.plugins?.tooltip?.callbacks?.label as (item: TooltipItem<'bar'>) => string;

    expect(label(tooltipFor<'bar'>(1))).toBe('25 detecciones, 30,9 %');
  });
});

describe('hourBarConfig', () => {
  const hours: ActivityHour[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hour === 18 ? 14 : hour === 8 ? 3 : 0
  }));
  const config = hourBarConfig(hours, resolve);

  it('draws 24 bars with the counts of each hour', () => {
    expect(config.type).toBe('bar');
    expect(config.data.labels?.length).toBe(24);
    expect(config.data.datasets[0].data[18]).toBe(14);
    expect(config.data.datasets[0].data[8]).toBe(3);
    expect(config.data.datasets[0].backgroundColor).toBe('resuelto(var(--azul))');
    expect(config.options?.plugins?.legend?.display).toBe(false);
  });

  it('labels the axis every three hours', () => {
    const x = config.options?.scales?.['x'] as {
      ticks: { autoSkip: boolean; callback: (value: number, index: number) => string };
    };

    expect(x.ticks.autoSkip).toBe(false);
    expect(Array.from({ length: 24 }, (_, index) => x.ticks.callback(index, index)).filter(Boolean))
      .toEqual(['0', '3', '6', '9', '12', '15', '18', '21']);
  });

  it('names the hour and the count in the tooltip', () => {
    const callbacks = config.options?.plugins?.tooltip?.callbacks as {
      title: (items: TooltipItem<'bar'>[]) => string;
      label: (item: TooltipItem<'bar'>) => string;
    };

    expect(callbacks.title([tooltipFor<'bar'>(18)])).toBe('18 h');
    expect(callbacks.label(tooltipFor<'bar'>(18))).toBe('14 detecciones');
    expect(callbacks.label(tooltipFor<'bar'>(1))).toBe('0 detecciones');
  });
});

describe('videoBarConfig', () => {
  const bars = videoBars([
    { jobId: 'a', fileName: 'P1E_S1_C2.mp4', uploadedAt: '2026-11-17T16:21:13Z', count: 26 },
    { jobId: 'b', fileName: 'Camera_ch6.mp4', uploadedAt: null, count: 6 }
  ]);
  const config = videoBarConfig(bars, resolve);

  it('draws one horizontal bar per video in a single colour', () => {
    expect(config.type).toBe('bar');
    expect(config.options?.indexAxis).toBe('y');
    expect(config.data.labels).toEqual(['P1E_S1_C2.mp4 · 17/11/2026', 'Camera_ch6.mp4']);
    expect(config.data.datasets[0].data).toEqual([26, 6]);
    expect(config.data.datasets[0].backgroundColor).toEqual([
      'resuelto(var(--serie-1))', 'resuelto(var(--serie-1))'
    ]);
    expect(config.options?.plugins?.legend?.display).toBe(false);
    expect(config.options?.plugins?.title?.text).toBe('Detecciones por video');
  });

  it('writes the video and its count in the tooltip', () => {
    const label = config.options?.plugins?.tooltip?.callbacks?.label as (item: TooltipItem<'bar'>) => string;

    expect(label(tooltipFor<'bar'>(0))).toBe('P1E_S1_C2.mp4 · 17/11/2026: 26 detecciones');
  });
});

describe('followUpConfig', () => {
  const segments = followUpSegments({ investigation: 4, resolved: 0, markedOnly: 1, none: 76 }, 81);
  const config = followUpConfig(segments, 81, resolve);

  it('stacks one dataset per group on a single horizontal bar up to the total', () => {
    expect(config.type).toBe('bar');
    expect(config.options?.indexAxis).toBe('y');
    expect(config.data.labels).toEqual(['Detecciones']);
    expect(config.data.datasets.map(dataset => dataset.label)).toEqual([
      'Marcada sin reporte', 'Solucionado', 'En investigación', 'Sin seguimiento'
    ]);
    expect(config.data.datasets.map(dataset => dataset.data[0])).toEqual([1, 0, 4, 76]);
    expect(config.data.datasets.map(dataset => dataset.backgroundColor)).toEqual([
      'resuelto(var(--serie-1))', 'resuelto(var(--serie-3))',
      'resuelto(var(--serie-4))', 'resuelto(var(--serie-otras))'
    ]);
    expect(config.data.datasets.every(dataset => dataset.borderColor === 'resuelto(var(--superficie))')).toBe(true);
    const x = config.options?.scales?.['x'] as { stacked?: boolean; max?: number };
    const y = config.options?.scales?.['y'] as { stacked?: boolean };
    expect(x.stacked).toBe(true);
    expect(x.max).toBe(81);
    expect(y.stacked).toBe(true);
  });

  it('shows the legend on top without the empty groups and titles the chart', () => {
    const filter = config.options?.plugins?.legend?.labels?.filter as (item: { datasetIndex: number }) => boolean;

    expect(config.options?.plugins?.legend?.position).toBe('top');
    expect([0, 1, 2, 3].map(datasetIndex => filter({ datasetIndex }))).toEqual([true, false, true, true]);
    expect(config.options?.plugins?.title?.text).toBe('Seguimiento de las detecciones');
  });

  it('writes the group, count and share in the tooltip', () => {
    const label = config.options?.plugins?.tooltip?.callbacks?.label as (item: TooltipItem<'bar'>) => string;

    expect(label({ datasetIndex: 2 } as TooltipItem<'bar'>)).toBe('En investigación: 4 detecciones, 4,9 %');
  });
});
