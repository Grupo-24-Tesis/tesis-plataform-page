import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartConfiguration } from 'chart.js';

import { ActivityVideo } from '../../../core/models/activity.model';
import { ChartFactory } from '../../../shared/charts/chart-factory';
import { VideoDetectionsChartComponent } from './video-detections-chart';

const VIDEOS: ActivityVideo[] = [
  { jobId: 'a', fileName: 'P1E_S1_C2.mp4', uploadedAt: '2026-11-17T16:21:13Z', count: 26 },
  { jobId: 'b', fileName: 'Camera_ch6.mp4', uploadedAt: null, count: 6 }
];

describe('VideoDetectionsChartComponent', () => {
  let fixture: ComponentFixture<VideoDetectionsChartComponent>;
  let created: { canvas: HTMLCanvasElement; config: ChartConfiguration; destroy: ReturnType<typeof vi.fn> }[];

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function render(videos = VIDEOS, total = 32): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [VideoDetectionsChartComponent],
      providers: [{
        provide: ChartFactory,
        useValue: {
          resolve: (value: string) => value,
          create: (canvas: HTMLCanvasElement, config: ChartConfiguration) => {
            const chart = { canvas, config, destroy: vi.fn() };
            created.push(chart);
            return chart;
          }
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(VideoDetectionsChartComponent);
    fixture.componentRef.setInput('videos', videos);
    fixture.componentRef.setInput('total', total);
    await fixture.whenStable();
  }

  beforeEach(() => {
    created = [];
  });

  afterEach(() => fixture?.destroy());

  it('draws the per-video bars on the canvas with a summary for screen readers', async () => {
    await render();

    const canvas = root().querySelector('canvas')!;
    expect(created.length).toBe(1);
    expect(created[0].canvas).toBe(canvas);
    expect(created[0].config.type).toBe('bar');
    expect(created[0].config.data.datasets[0].data).toEqual([26, 6]);
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe(
      'Detecciones por video: P1E_S1_C2.mp4 · 17/11/2026 26, Camera_ch6.mp4 6'
    );
    expect(root().querySelector<HTMLElement>('.chart-box')?.style.height).toBe('150px');
  });

  it('lists the videos in a table with the total', async () => {
    await render();

    const rows = Array.from(root().querySelectorAll('table.legend tbody tr'))
      .map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim()));
    expect(rows).toEqual([['P1E_S1_C2.mp4 · 17/11/2026', '26'], ['Camera_ch6.mp4', '6']]);
    expect(Array.from(root().querySelectorAll('table.legend tfoot th, table.legend tfoot td'))
      .map(cell => cell.textContent?.trim())).toEqual(['Total', '32']);
  });

  it('redraws when the videos change and destroys the chart with the component', async () => {
    await render();
    const first = created[0];

    fixture.componentRef.setInput('videos', [VIDEOS[1]]);
    await fixture.whenStable();

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(created[1].config.data.datasets[0].data).toEqual([6]);
    fixture.destroy();
    expect(created[1].destroy).toHaveBeenCalledTimes(1);
  });
});
