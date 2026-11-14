import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Shell } from './shell';
import { SessionService } from '../../core/services/session.service';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let session: SessionService;

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([])],
    }).compileComponents();
    session = TestBed.inject(SessionService);
  });

  afterEach(() => localStorage.clear());

  it('muestra el nombre del vigilante activo', async () => {
    session.setActiveGuard({ id: 'g1', name: 'Laura Martinez' });

    const element = await render();

    expect(element.querySelector('.guard')?.textContent).toContain('Laura Martinez');
  });

  it('muestra los cinco enlaces de navegacion', async () => {
    const element = await render();
    const hrefs = Array.from(element.querySelectorAll('nav a')).map(link =>
      link.getAttribute('href')
    );

    expect(hrefs).toEqual(['/monitor', '/activity', '/unique-faces', '/reports', '/marked']);
    expect(element.querySelector('nav')?.textContent).toContain('Actividad');
    expect(element.querySelector('nav')?.textContent).toContain('Rostros detectados');
    expect(element.querySelector('nav')?.textContent).toContain('Marcados');
  });

  it('no repite el icono de un enlace en otro enlace', async () => {
    const element = await render();
    const icons = Array.from(element.querySelectorAll('nav a .nav-icon'))
      .map(icon => icon.textContent?.trim() ?? '')
      .filter(icon => icon !== '');

    expect(new Set(icons).size).toBe(icons.length);
  });

  it('cierra la sesion y vuelve a la seleccion de vigilante', async () => {
    session.setActiveGuard({ id: 'g1', name: 'Laura Martinez' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const element = await render();

    (element.querySelector('.logout') as HTMLButtonElement).click();

    expect(session.getActiveGuard()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/guards');
  });
});
