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

import { ActivityFollowUp } from '../../../core/models/activity.model';
import { ChartFactory, ChartHandle } from '../../../shared/charts/chart-factory';
import { followUpSegments, followUpSummary } from '../activity-breakdowns';
import { followUpConfig } from '../activity-chart-configs';
import { formatPercent } from '../camera-share';

const CHART_HEIGHT_PX = 150;

@Component({
  selector: 'app-follow-up-chart',
  templateUrl: './follow-up-chart.html',
  styleUrls: ['../chart-table.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FollowUpChartComponent {
  followUp = input.required<ActivityFollowUp>();
  total = input.required<number>();

  readonly chartHeight = CHART_HEIGHT_PX;
  readonly totalPercent = formatPercent(100);

  segments = computed(() => followUpSegments(this.followUp(), this.total()));
  summary = computed(() => followUpSummary(this.segments()));

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private readonly charts = inject(ChartFactory);
  private chart?: ChartHandle;

  constructor() {
    afterRenderEffect(() => {
      const segments = this.segments();
      const total = this.total();
      const canvas = this.canvas().nativeElement;

      this.chart?.destroy();
      this.chart = this.charts.create(canvas, followUpConfig(segments, total, this.charts.resolve));
    });

    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = undefined;
    });
  }

  percent(value: number): string {
    return formatPercent(value);
  }
}
