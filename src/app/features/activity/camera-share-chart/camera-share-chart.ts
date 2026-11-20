import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';

import { ActivityCamera } from '../../../core/models/activity.model';
import { ChartFactory, ChartHandle } from '../../../shared/charts/chart-factory';
import { cameraBarConfig, cameraPieConfig } from '../activity-chart-configs';
import { cameraShares, formatPercent, shareSummary } from '../camera-share';

export const VIEW_STORAGE_KEY = 'facecluster.actividad.vista';
const PIE_HEIGHT_PX = 320;
const BAR_BASE_HEIGHT_PX = 70;
const BAR_ROW_HEIGHT_PX = 44;

export type ShareView = 'circular' | 'barras';

function storedView(): ShareView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'barras' ? 'barras' : 'circular';
  } catch {
    return 'circular';
  }
}

function storeView(view: ShareView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    return;
  }
}

@Component({
  selector: 'app-camera-share-chart',
  templateUrl: './camera-share-chart.html',
  styleUrls: ['../chart-table.css', './camera-share-chart.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CameraShareChartComponent {
  cameras = input.required<ActivityCamera[]>();
  total = input.required<number>();
  cameraOrder = input<string[]>([]);

  readonly totalPercent = formatPercent(100);

  view = signal<ShareView>(storedView());

  shares = computed(() => cameraShares(this.cameras(), this.cameraOrder()));
  summary = computed(() => shareSummary(this.shares()));
  chartHeight = computed(() =>
    this.view() === 'circular'
      ? PIE_HEIGHT_PX
      : BAR_BASE_HEIGHT_PX + BAR_ROW_HEIGHT_PX * this.shares().length
  );

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private readonly charts = inject(ChartFactory);
  private chart?: ChartHandle;

  constructor() {
    afterRenderEffect(() => {
      const shares = this.shares();
      const view = this.view();
      const canvas = this.canvas().nativeElement;

      this.chart?.destroy();
      this.chart = view === 'circular'
        ? this.charts.create(canvas, cameraPieConfig(shares, this.charts.resolve))
        : this.charts.create(canvas, cameraBarConfig(shares, this.charts.resolve));
    });

    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = undefined;
    });
  }

  percent(value: number): string {
    return formatPercent(value);
  }

  show(view: ShareView): void {
    this.view.set(view);
    storeView(view);
  }
}
