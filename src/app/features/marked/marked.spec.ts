import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { Marked } from './marked';

const FACES = [
  { id: 'a', faceId: 'job-1_1', timestamp: '00:00:01', cameraId: 'CAM-01', frameUrl: 'https://x/1.jpg' },
  { id: 'b', faceId: 'job-1_2', timestamp: '00:00:02', cameraId: 'CAM-01', frameUrl: 'https://x/2.jpg' }
];

describe('Marked', () => {
  let fixture: ComponentFixture<Marked>;
  let component: Marked;
  let api: {
    getMarked: ReturnType<typeof vi.fn>;
    getFaceAppearances: ReturnType<typeof vi.fn>;
    createMarked: ReturnType<typeof vi.fn>;
    deleteMarked: ReturnType<typeof vi.fn>;
  };
  let alertSpy: ReturnType<typeof vi.spyOn>;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Marked],
      providers: [{ provide: ApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(Marked);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function click(selector: string): void {
    fixture.nativeElement.querySelector(selector).click();
  }

  beforeEach(() => {
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    api = {
      getMarked: vi.fn(() => of([{ id: 'm1', faceId: 'job-1_1', reason: 'Merodeo' }])),
      getFaceAppearances: vi.fn(() => of(FACES)),
      createMarked: vi.fn(),
      deleteMarked: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('lists only the marks returned by the backend and never reads localStorage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    await create();

    expect(component.marked().length).toBe(1);
    expect(text()).toContain('Merodeo');
    expect(getItem).not.toHaveBeenCalled();
  });

  it('does not let an already marked face be picked again', async () => {
    await create();
    component.openModal();
    fixture.detectChanges();

    const options: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.person-option')
    );

    expect(options[0].disabled).toBe(true);
    expect(options[1].disabled).toBe(false);

    component.selectPerson(component.people()[0]);
    expect(component.selectedPerson()).toBeNull();
  });

  it('asks for confirmation before deleting', async () => {
    api.deleteMarked.mockReturnValue(of(undefined));
    await create();

    click('.delete-button');
    fixture.detectChanges();

    expect(api.deleteMarked).not.toHaveBeenCalled();
    expect(text()).toContain('¿Quitar esta marca?');

    click('.confirm-delete');
    await fixture.whenStable();

    expect(api.deleteMarked).toHaveBeenCalledWith('m1');
    expect(component.marked().length).toBe(0);
  });

  it('cancels the deletion without calling the backend', async () => {
    await create();

    click('.delete-button');
    fixture.detectChanges();
    click('.cancel-button');
    fixture.detectChanges();

    expect(api.deleteMarked).not.toHaveBeenCalled();
    expect(component.marked().length).toBe(1);
  });

  it('renders the backend error message', async () => {
    api.createMarked.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { status: 409, message: 'La deteccion ya esta marcada' }
      }))
    );
    await create();

    component.openModal();
    component.selectPerson(component.people()[1]);
    component.reason.set('Motivo');
    component.createMarked();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.modal .feedback').textContent)
      .toContain('La deteccion ya esta marcada');
    expect(component.selectedPerson()).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows validation feedback inline instead of alert', async () => {
    await create();

    component.openModal();
    component.createMarked();
    await fixture.whenStable();

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.modal .feedback').textContent)
      .toContain('Selecciona una detección.');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('sends a single create request on a double click', async () => {
    const pending = new Subject<unknown>();
    api.createMarked.mockReturnValue(pending);
    await create();

    component.openModal();
    component.selectPerson(component.people()[1]);
    component.reason.set('Motivo');
    component.createMarked();
    component.createMarked();

    expect(api.createMarked).toHaveBeenCalledTimes(1);
  });

  it('sends a single delete request on a double click', async () => {
    const pending = new Subject<void>();
    api.deleteMarked.mockReturnValue(pending);
    await create();

    component.confirmDelete(component.marked()[0]);
    component.confirmDelete(component.marked()[0]);

    expect(api.deleteMarked).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message when deleting fails', async () => {
    api.deleteMarked.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 404,
        error: { status: 404, message: 'La marca no existe' }
      }))
    );
    await create();

    component.confirmDelete(component.marked()[0]);
    await fixture.whenStable();

    expect(text()).toContain('La marca no existe');
  });

  it('shows the loading state until the marks arrive', async () => {
    const pending = new Subject<unknown[]>();
    api.getMarked.mockReturnValue(pending);
    await create();

    expect(text()).toContain('Cargando...');
    expect(text()).not.toContain('No hay detecciones marcadas');

    pending.next([{ id: 'm1', faceId: 'job-1_1', reason: 'Merodeo' }]);
    pending.complete();
    fixture.detectChanges();

    expect(text()).not.toContain('Cargando...');
    expect(text()).toContain('Merodeo');
  });

  it('shows the backend error with a retry that reloads', async () => {
    api.getMarked.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { status: 500, message: 'Fallo al leer las marcas' }
      }))
    );
    await create();

    expect(text()).toContain('Fallo al leer las marcas');
    expect(text()).not.toContain('No hay detecciones marcadas');

    const retry: HTMLButtonElement = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find(button => button.textContent?.includes('Reintentar'))!;
    retry.click();
    fixture.detectChanges();

    expect(api.getMarked).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('Fallo al leer las marcas');
    expect(text()).toContain('Merodeo');
  });

  it('shows the empty state only after loading finishes without marks', async () => {
    api.getMarked.mockReturnValue(of([]));
    await create();

    expect(text()).toContain('No hay detecciones marcadas');
  });
});
