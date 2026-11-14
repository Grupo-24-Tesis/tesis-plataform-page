import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-video-retry',
  template: `
    @if (error()) {
      <span class="retry-error">{{ error() }}</span>
    }
    <button
      type="button"
      class="retry-button"
      [disabled]="busy()"
      (click)="retry.emit()"
    >
      {{ busy() ? 'Reintentando...' : 'Reintentar' }}
    </button>
  `,
  styleUrl: './video-retry.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoRetryComponent {
  busy = input(false);
  error = input('');
  retry = output<void>();
}
