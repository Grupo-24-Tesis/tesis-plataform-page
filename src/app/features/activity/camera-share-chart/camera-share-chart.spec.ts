import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartConfiguration } from 'chart.js';

import { ActivityCamera } from '../../../core/models/activity.model';
import { ChartFactory } from '../../../shared/charts/chart-factory';
import { CameraShareChartComponent, VIEW_STORAGE_KEY } from './camera-share-chart';

const CAMERAS: ActivityCamera[] = [
  { cameraId: 'c0', cameraName: 'Entrada Principal', count: 26 },
  { cameraId: 'c2', cameraName: 'Zona Común Piscina', count: 25 },
  { cameraId: 'c1', cameraName: 'Parqueadero A', count: 24 },
  { cameraId: 'c9', cameraName: 'Torre 1', count: 6 }
];
const ORDER = ['c0', 'c1', 'c9', 'c2'];

interface FakeChart {
  canvas: HTMLCanvasElement;
  config: ChartConfiguration;
  destroy: ReturnType<typeof vi.fn>;
}

describe('CameraShareChartComponent', () => {
  let fixture: ComponentFixture<CameraShareChartComponent>;
  let created: FakeChart[];

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function latest(): FakeChart {
    return created[created.length - 1];
  }

  function switchButton(label: string): HTMLButtonElement {
    return Array.from(root().querySelectorAll<HTMLButtonElement>('.view-switch button'))
      .find(button => button.textContent?.trim() === label)!;
  }

  async function render(cameras = CAMERAS, total = 81): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CameraShareChartComponent],
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
    fixture = TestBed.createComponent(CameraShareChartComponent);
    fixture.componentRef.setInput('cameras', cameras);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('cameraOrder', ORDER);
    await fixture.whenStable();
  }

  beforeEach(() => {
    created = [];
    localStorage.removeItem(VIEW_STORAGE_KEY);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
    localStorage.removeItem(VIEW_STORAGE_KEY);
  });

  it('draws a Chart.js pie on the canvas by default', async () => {
    await render();

    const canvas = root().querySelector('canvas')!;
    expect(created.length).toBe(1);
    expect(latest().canvas).toBe(canvas);
    expect(latest().config.type).toBe('pie');
    expect(latest().config.data.datasets[0].data).toEqual([26, 24, 6, 25]);
    expect(switchButton('Circular').getAttribute('aria-pressed')).toBe('true');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe(
      'Detecciones por cámara: Entrada Principal 32,1 %, Parqueadero A 29,6 %, ' +
      'Torre 1 7,4 %, Zona Común Piscina 30,9 %'
    );
  });

  it('replaces the pie with ranked bars and remembers the choice', async () => {
    await render();
    const pie = latest();

    switchButton('Barras').click();
    await fixture.whenStable();

    expect(pie.destroy).toHaveBeenCalledTimes(1);
    expect(latest().config.type).toBe('bar');
    expect(latest().config.data.labels).toEqual([
      'Entrada Principal', 'Zona Común Piscina', 'Parqueadero A', 'Torre 1'
    ]);
    expect(switchButton('Barras').getAttribute('aria-pressed')).toBe('true');
    expect(root().querySelector<HTMLElement>('.chart-box')?.style.height).toBe('246px');
    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe('barras');
  });

  it('restores the bars view from storage', async () => {
    localStorage.setItem(VIEW_STORAGE_KEY, 'barras');
    await render();

    expect(created.length).toBe(1);
    expect(latest().config.type).toBe('bar');
  });

  it('still draws when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    await render();

    expect(latest().config.type).toBe('pie');
    switchButton('Barras').click();
    await fixture.whenStable();
    expect(latest().config.type).toBe('bar');
  });

  it('redraws when the data changes and destroys the chart with the component', async () => {
    await render();
    const first = latest();

    fixture.componentRef.setInput('cameras', [CAMERAS[0]]);
    await fixture.whenStable();

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(latest().config.data.datasets[0].data).toEqual([26]);

    const last = latest();
    fixture.destroy();
    expect(last.destroy).toHaveBeenCalledTimes(1);
  });

  it('lists every camera in the legend table with count, share and total', async () => {
    await render();

    const rows = Array.from(root().querySelectorAll('table.legend tbody tr'));
    expect(rows.map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim())))
      .toEqual([
        ['', 'Entrada Principal', '26', '32,1 %'],
        ['', 'Parqueadero A', '24', '29,6 %'],
        ['', 'Torre 1', '6', '7,4 %'],
        ['', 'Zona Común Piscina', '25', '30,9 %']
      ]);
    expect(rows[2].querySelector<HTMLElement>('.swatch')?.style.background).toBe('var(--serie-3)');
    expect(Array.from(root().querySelectorAll('table.legend tfoot th, table.legend tfoot td'))
      .map(cell => cell.textContent?.trim()))
      .toEqual(['Total', '81', '100,0 %']);
  });
});
