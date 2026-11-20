import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  viewChild
} from '@angular/core';

import { ActivityVideo } from '../../../core/models/activity.model';
import { ChartFactory, ChartHandle } from '../../../shared/charts/chart-factory';
import { videoBars, videoSummary } from '../activity-breakdowns';
import { videoBarConfig } from '../activity-chart-configs';

const BASE_HEIGHT_PX = 70;
const ROW_HEIGHT_PX = 40;

@Component({
  selector: 'app-video-detections-chart',
  templateUrl: './video-detections-chart.html',
  styleUrls: ['../chart-table.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoDetectionsChartComponent {
  videos = input.required<ActivityVideo[]>();
  total = input.required<number>();

  bars = computed(() => videoBars(this.videos()));
  summary = computed(() => videoSummary(this.bars()));
  chartHeight = computed(() => BASE_HEIGHT_PX + ROW_HEIGHT_PX * Math.max(this.bars().length, 1));

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private readonly charts = inject(ChartFactory);
  private chart?: ChartHandle;

  constructor() {
    afterRenderEffect(() => {
      const bars = this.bars();
      const canvas = this.canvas().nativeElement;

      this.chart?.destroy();
      this.chart = this.charts.create(canvas, videoBarConfig(bars, this.charts.resolve));
    });

    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = undefined;
    });
  }
}
