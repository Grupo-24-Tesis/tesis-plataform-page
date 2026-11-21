import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaceTileComponent, detectionNumber } from './face-tile';

describe('FaceTileComponent', () => {
  let fixture: ComponentFixture<FaceTileComponent>;

  function tile(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button.face-tile');
  }

  async function render(face: { faceId: string; timestamp: string; frameUrl?: string; matchCount?: number }, selected = false) {
    fixture.componentRef.setInput('face', face);
    fixture.componentRef.setInput('selected', selected);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaceTileComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(FaceTileComponent);
  });

  it('shows the whole image inside a square frame', async () => {
    await render({ faceId: 'job1_7', timestamp: '00:00:06', frameUrl: 'https://example.com/7.jpg' });

    const frame: HTMLElement = fixture.nativeElement.querySelector('.face-frame');
    const image: HTMLImageElement = frame.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('https://example.com/7.jpg');
    expect(getComputedStyle(image).objectFit).toBe('contain');
    expect(getComputedStyle(frame).aspectRatio).toBe('1 / 1');
  });

  it('shows the placeholder when there is no image', async () => {
    await render({ faceId: 'job1_7', timestamp: '00:00:06' });

    expect(fixture.nativeElement.querySelector('.face-frame img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.face-frame .image-placeholder')).not.toBeNull();
  });

  it('labels the tile with the detection number and the time in the video', async () => {
    await render({ faceId: '6afc7ef963f1a97605ebbf1d_12', timestamp: '00:01:05', frameUrl: 'x.jpg' });

    expect(fixture.nativeElement.querySelector('.face-label').textContent.trim()).toBe('Detección 12');
    expect(fixture.nativeElement.querySelector('.face-time').textContent.trim()).toBe('00:01:05');
    expect(tile().getAttribute('aria-label')).toBe('Detección 12, 00:01:05');
    expect(fixture.nativeElement.querySelector('img').getAttribute('alt')).toBe('Detección 12');
  });

  it('emits when clicked and reflects the selected state', async () => {
    const picked = vi.fn();
    fixture.componentInstance.pick.subscribe(picked);
    await render({ faceId: 'job1_7', timestamp: '00:00:06' });

    expect(tile().getAttribute('aria-pressed')).toBe('false');
    tile().click();
    expect(picked).toHaveBeenCalledTimes(1);

    await render({ faceId: 'job1_7', timestamp: '00:00:06' }, true);
    expect(tile().getAttribute('aria-pressed')).toBe('true');
    expect(tile().classList).toContain('selected');
  });

  it('shows the badge from matchCount', async () => {
    await render({ faceId: 'job1_7', timestamp: '00:00:06', matchCount: 2 });
    expect(fixture.nativeElement.querySelector('app-match-count-badge .match-count').textContent.trim()).toBe('2 coincidencias');
    expect(tile().getAttribute('aria-label')).toBe('Detección 7, 00:00:06, 2 coincidencias');

    await render({ faceId: 'job1_7', timestamp: '00:00:06' });
    expect(fixture.nativeElement.querySelector('.match-count')).toBeNull();
  });

  it('takes the number after the last underscore of the face id', () => {
    expect(detectionNumber('6afc7ef963f1a97605ebbf1d_3')).toBe('3');
    expect(detectionNumber('a_b_15')).toBe('15');
    expect(detectionNumber('sin-guion')).toBe('sin-guion');
    expect(detectionNumber('termina_')).toBe('termina_');
  });
});
