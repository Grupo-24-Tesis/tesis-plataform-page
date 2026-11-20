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

import { ActivityHour } from '../../core/models/activity.model';
import { ChartFactory, ChartHandle } from '../../shared/charts/chart-factory';
import { hourBarConfig } from './activity-chart-configs';

@Component({
  selector: 'app-activity-chart',
  standalone: true,
  templateUrl: './activity-chart.html',
  styleUrl: './activity-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityChartComponent {
  hours = input.required<ActivityHour[]>();

  summary = computed(() => {
    const max = this.hours().reduce((highest, entry) => Math.max(highest, entry.count), 0);
    const peak = this.hours().find(entry => entry.count === max);

    if (!peak || max === 0) {
      return 'Detecciones por hora: no hay detecciones';
    }

    return `Detecciones por hora: el máximo es ${max} a las ${peak.hour} h`;
  });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private readonly charts = inject(ChartFactory);
  private chart?: ChartHandle;

  constructor() {
    afterRenderEffect(() => {
      const hours = this.hours();
      const canvas = this.canvas().nativeElement;

      this.chart?.destroy();
      this.chart = this.charts.create(canvas, hourBarConfig(hours, this.charts.resolve));
    });

    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = undefined;
    });
  }
}
