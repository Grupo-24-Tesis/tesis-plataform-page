import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';

export interface FaceTileFace {
  faceId: string;
  timestamp: string;
  frameUrl?: string;
}

export function detectionNumber(faceId: string): string {
  const separator = faceId.lastIndexOf('_');
  const suffix = separator >= 0 ? faceId.slice(separator + 1) : '';
  return suffix || faceId;
}

@Component({
  selector: 'app-face-tile',
  imports: [ImageFallbackDirective],
  template: `
    <button
      type="button"
      class="face-tile"
      [class.selected]="selected()"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="label() + ', ' + face().timestamp"
      (click)="pick.emit()"
    >
      <span class="face-frame">
        @if (face().frameUrl; as image) {
          <img appImageFallback [src]="image" [alt]="label()" loading="lazy">
        } @else {
          <span class="image-placeholder" aria-hidden="true">♙</span>
        }
      </span>
      <span class="face-caption">
        <strong class="face-label">{{ label() }}</strong>
        <span class="face-time">{{ face().timestamp }}</span>
      </span>
    </button>
  `,
  styleUrl: './face-tile.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaceTileComponent {
  face = input.required<FaceTileFace>();
  selected = input(false);
  pick = output<void>();

  label = computed(() => `Detección ${detectionNumber(this.face().faceId)}`);
}
