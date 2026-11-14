import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface MetricItem {
  label: string;
  value: string;
}

@Component({
  selector: 'app-metrics-strip',
  template: `
    @if (items().length > 0) {
      <div class="metrics-strip">
        @for (item of items(); track item.label) {
          <div class="metric-item">
            <small>{{ item.label }}</small>
            <strong>{{ item.value }}</strong>
          </div>
        }
      </div>
    }
  `,
  styleUrl: './metrics-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricsStripComponent {
  items = input.required<MetricItem[]>();
}
