import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoRetryComponent } from './video-retry';

describe('VideoRetryComponent', () => {
  let fixture: ComponentFixture<VideoRetryComponent>;

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoRetryComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(VideoRetryComponent);
    await fixture.whenStable();
  });

  it('shows an enabled Reintentar button that emits retry', async () => {
    const emitted = vi.fn();
    fixture.componentInstance.retry.subscribe(emitted);

    button().click();

    expect(button().textContent).toContain('Reintentar');
    expect(button().disabled).toBe(false);
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('disables the button and shows Reintentando while busy', async () => {
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Reintentando...');
  });

  it('shows the error text only when there is one', async () => {
    expect(fixture.nativeElement.querySelector('.retry-error')).toBeNull();

    fixture.componentRef.setInput('error', 'Solo se pueden reintentar videos fallidos');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.retry-error').textContent)
      .toContain('Solo se pueden reintentar videos fallidos');
  });
});
