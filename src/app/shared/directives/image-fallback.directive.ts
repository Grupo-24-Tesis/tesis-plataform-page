import { Directive, ElementRef, HostListener, Renderer2 } from '@angular/core';

/**
 * Las imágenes de rostros son URLs prefirmadas de S3 que expiran y pueden
 * borrarse del bucket. Si una falla al cargar, se oculta y se muestra el
 * mismo marcador (♙) que se usa cuando no hay imagen.
 */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective {
  private replaced = false;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private renderer: Renderer2
  ) {}

  @HostListener('error')
  onError(): void {
    if (this.replaced) {
      return;
    }
    this.replaced = true;

    const img = this.el.nativeElement;
    this.renderer.setStyle(img, 'display', 'none');

    const placeholder = this.renderer.createElement('span');
    this.renderer.addClass(placeholder, 'image-placeholder');
    this.renderer.setAttribute(placeholder, 'aria-hidden', 'true');
    this.renderer.appendChild(placeholder, this.renderer.createText('♙'));

    // Mismo atributo de encapsulación que el <img> para que aplique el CSS
    // del componente a .image-placeholder.
    for (const attr of Array.from(img.attributes)) {
      if (attr.name.startsWith('_ngcontent')) {
        this.renderer.setAttribute(placeholder, attr.name, '');
      }
    }

    const parent = this.renderer.parentNode(img);
    if (parent) {
      this.renderer.insertBefore(parent, placeholder, this.renderer.nextSibling(img));
    }
  }
}
