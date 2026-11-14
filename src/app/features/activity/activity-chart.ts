import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ActivityHour } from '../../core/models/activity.model';

const PLOT_HEIGHT = 150;
const PLOT_TOP = 10;
const BAR_STEP = 20;
const BAR_WIDTH = 14;
const BAR_OFFSET = 4;
const LABEL_EVERY = 3;

@Component({
  selector: 'app-activity-chart',
  standalone: true,
  templateUrl: './activity-chart.html',
  styleUrl: './activity-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityChartComponent {
  hours = input.required<ActivityHour[]>();

  readonly baseline = PLOT_TOP + PLOT_HEIGHT;
  readonly labelY = PLOT_TOP + PLOT_HEIGHT + 18;
  readonly width = BAR_STEP * 24;
  readonly height = PLOT_TOP + PLOT_HEIGHT + 26;
  readonly barWidth = BAR_WIDTH;

  maxCount = computed(() =>
    this.hours().reduce((max, entry) => Math.max(max, entry.count), 0)
  );

  bars = computed(() => {
    const max = this.maxCount();

    return this.hours().map(entry => {
      const barHeight = max === 0 ? 0 : (entry.count / max) * PLOT_HEIGHT;

      return {
        hour: entry.hour,
        count: entry.count,
        x: entry.hour * BAR_STEP + BAR_OFFSET,
        y: PLOT_TOP + PLOT_HEIGHT - barHeight,
        height: barHeight,
        label: entry.hour % LABEL_EVERY === 0 ? String(entry.hour) : '',
        labelX: entry.hour * BAR_STEP + BAR_OFFSET + BAR_WIDTH / 2,
        title: `${entry.hour} h: ${entry.count} ${entry.count === 1 ? 'detección' : 'detecciones'}`,
      };
    });
  });

  summary = computed(() => {
    const max = this.maxCount();
    const peak = this.hours().find(entry => entry.count === max);

    if (!peak || max === 0) {
      return 'Detecciones por hora: no hay detecciones';
    }

    return `Detecciones por hora: el máximo es ${max} a las ${peak.hour} h`;
  });
}
