import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartConfiguration } from 'chart.js';

import { ActivityFollowUp } from '../../../core/models/activity.model';
import { ChartFactory } from '../../../shared/charts/chart-factory';
import { FollowUpChartComponent } from './follow-up-chart';

const FOLLOW_UP: ActivityFollowUp = { investigation: 4, resolved: 2, markedOnly: 1, none: 74 };

describe('FollowUpChartComponent', () => {
  let fixture: ComponentFixture<FollowUpChartComponent>;
  let created: { canvas: HTMLCanvasElement; config: ChartConfiguration; destroy: ReturnType<typeof vi.fn> }[];

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function render(followUp = FOLLOW_UP, total = 81): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [FollowUpChartComponent],
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
    fixture = TestBed.createComponent(FollowUpChartComponent);
    fixture.componentRef.setInput('followUp', followUp);
    fixture.componentRef.setInput('total', total);
    await fixture.whenStable();
  }

  beforeEach(() => {
    created = [];
  });

  afterEach(() => fixture?.destroy());

  it('draws the segmented bar on the canvas with a summary for screen readers', async () => {
    await render();

    const canvas = root().querySelector('canvas')!;
    expect(created.length).toBe(1);
    expect(created[0].canvas).toBe(canvas);
    expect(created[0].config.data.datasets.map(dataset => dataset.data[0])).toEqual([1, 2, 4, 74]);
    expect(canvas.getAttribute('aria-label')).toBe(
      'Seguimiento de las detecciones: Marcada sin reporte 1,2 %, Solucionado 2,5 %, ' +
      'En investigación 4,9 %, Sin seguimiento 91,4 %'
    );
  });

  it('lists every group with its colour, count and share, and the total', async () => {
    await render();

    const rows = Array.from(root().querySelectorAll('table.legend tbody tr'));
    expect(rows.map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim())))
      .toEqual([
        ['', 'Marcada sin reporte', '1', '1,2 %'],
        ['', 'Solucionado', '2', '2,5 %'],
        ['', 'En investigación', '4', '4,9 %'],
        ['', 'Sin seguimiento', '74', '91,4 %']
      ]);
    expect(rows[2].querySelector<HTMLElement>('.swatch')?.style.background).toBe('var(--serie-4)');
    expect(Array.from(root().querySelectorAll('table.legend tfoot th, table.legend tfoot td'))
      .map(cell => cell.textContent?.trim())).toEqual(['Total', '81', '100,0 %']);
  });

  it('redraws when the follow-up changes', async () => {
    await render();

    fixture.componentRef.setInput('followUp', { investigation: 0, resolved: 0, markedOnly: 1, none: 80 });
    await fixture.whenStable();

    expect(created[0].destroy).toHaveBeenCalledTimes(1);
    expect(created[1].config.data.datasets.map(dataset => dataset.data[0])).toEqual([1, 0, 0, 80]);
  });
});
