import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchCountBadgeComponent } from './match-count-badge';

describe('MatchCountBadgeComponent', () => {
  let fixture: ComponentFixture<MatchCountBadgeComponent>;

  async function render(count: number | undefined): Promise<string | null> {
    fixture.componentRef.setInput('count', count);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('.match-count')?.textContent.trim() ?? null;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MatchCountBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(MatchCountBadgeComponent);
  });

  it('renders singular and plural and nothing for zero', async () => {
    expect(await render(1)).toBe('1 coincidencia');
    expect(await render(3)).toBe('3 coincidencias');
    expect(await render(0)).toBeNull();
    expect(await render(undefined)).toBeNull();
  });
});
