import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export function matchCountLabel(count: number | undefined): string {
  if (!count || count < 1) {
    return '';
  }

  return count === 1 ? '1 coincidencia' : `${count} coincidencias`;
}

@Component({
  selector: 'app-match-count-badge',
  standalone: true,
  template: `@if (label(); as text) {<span class="match-count">{{ text }}</span>}`,
  styleUrl: './match-count-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchCountBadgeComponent {
  readonly count = input<number | undefined>();

  readonly label = computed(() => matchCountLabel(this.count()));
}
