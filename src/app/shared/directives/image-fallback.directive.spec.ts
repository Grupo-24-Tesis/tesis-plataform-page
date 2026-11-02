import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageFallbackDirective } from './image-fallback.directive';

@Component({
  standalone: true,
  imports: [ImageFallbackDirective],
  template: `<div id="host"><img appImageFallback alt="rostro" /></div>`,
})
class HostComponent {}

/** PR-01 – Si la imagen prefirmada falla, se oculta y se muestra un marcador. */
describe('ImageFallbackDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let img: HTMLImageElement;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('#host');
    img = host.querySelector('img') as HTMLImageElement;
  });

  const placeholders = () => host.querySelectorAll('.image-placeholder');

  it('no hace nada mientras la imagen carga bien', () => {
    expect(img.style.display).toBe('');
    expect(placeholders()).toHaveLength(0);
  });

  it('al fallar oculta la imagen y agrega el marcador ♙ justo después', () => {
    img.dispatchEvent(new Event('error'));

    expect(img.style.display).toBe('none');
    expect(placeholders()).toHaveLength(1);
    const placeholder = img.nextElementSibling as HTMLElement;
    expect(placeholder.classList.contains('image-placeholder')).toBe(true);
    expect(placeholder.textContent).toBe('♙');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
  });

  it('si la imagen vuelve a fallar no duplica el marcador', () => {
    img.dispatchEvent(new Event('error'));
    img.dispatchEvent(new Event('error'));
    img.dispatchEvent(new Event('error'));

    expect(placeholders()).toHaveLength(1);
  });

  it('copia el atributo de encapsulación _ngcontent al marcador', () => {
    img.setAttribute('_ngcontent-abc-c1', '');

    img.dispatchEvent(new Event('error'));

    const placeholder = img.nextElementSibling as HTMLElement;
    expect(placeholder.hasAttribute('_ngcontent-abc-c1')).toBe(true);
  });
});
