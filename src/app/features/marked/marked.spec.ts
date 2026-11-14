import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
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
    getGuards: ReturnType<typeof vi.fn>;
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
      getGuards: vi.fn(() => of([{ id: 'g1', name: 'Marta', shift: '', schedule: '' }])),
      createMarked: vi.fn(),
      deleteMarked: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    localStorage.clear();
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
        error: { status: 409, message: 'La detección ya está marcada' }
      }))
    );
    await create();

    component.openModal();
    component.selectPerson(component.people()[1]);
    component.reason.set('Motivo');
    component.createMarked();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.modal .feedback').textContent)
      .toContain('La detección ya está marcada');
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

  async function openPendingCreate(): Promise<Subject<unknown>> {
    const pending = new Subject<unknown>();
    api.createMarked.mockReturnValue(pending);
    await create();

    component.openModal();
    component.selectPerson(component.people()[1]);
    component.reason.set('Motivo');
    component.createMarked();
    await fixture.whenStable();
    return pending;
  }

  it('closes the modal with Escape', async () => {
    await create();
    component.openModal();
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(component.showModal()).toBe(false);
    expect(fixture.nativeElement.querySelector('.modal')).toBeNull();
  });

  it('keeps the modal open on Escape while the mark is being saved', async () => {
    await openPendingCreate();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(component.showModal()).toBe(true);
    expect(fixture.nativeElement.querySelector('.modal')).not.toBeNull();
  });

  it('ignores a click on the overlay while the mark is being saved', async () => {
    const pending = await openPendingCreate();

    click('.modal-overlay');
    await fixture.whenStable();
    expect(component.showModal()).toBe(true);

    pending.next({ id: 'm2', faceId: 'job-1_2', reason: 'Motivo' });
    await fixture.whenStable();
    expect(component.showModal()).toBe(false);
  });

  it('shows the appearances load error in the picker instead of the empty text', async () => {
    api.getFaceAppearances.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { status: 500, message: 'Fallo al listar las detecciones' }
      }))
    );
    await create();

    component.openModal();
    await fixture.whenStable();

    const picker = fixture.nativeElement.querySelector('.modal .people-section').textContent;
    expect(picker).toContain('Fallo al listar las detecciones');
    expect(picker).not.toContain('No hay detecciones disponibles para seleccionar.');
  });

  it('shows who created the mark when the guard is known', async () => {
    api.getMarked.mockReturnValue(of([
      { id: 'm1', faceId: 'job-1_1', reason: 'Merodeo', createdByGuardId: 'g1' }
    ]));
    await create();

    expect(text()).toContain('Marcado por Marta');
  });

  it('shows a fallback when the guard of the mark no longer exists', async () => {
    api.getMarked.mockReturnValue(of([
      { id: 'm1', faceId: 'job-1_1', reason: 'Merodeo', createdByGuardId: 'g-borrado' }
    ]));
    await create();

    expect(text()).toContain('Marcado por un vigilante sin registro');
  });

  it('shows no author line for old marks without a guard', async () => {
    await create();

    expect(text()).not.toContain('Marcado por');
  });

  it('sends the active guard id when creating a mark', async () => {
    api.createMarked.mockReturnValue(of({ id: 'm2', faceId: 'job-1_2', reason: 'Motivo' }));
    await create();
    TestBed.inject(SessionService).setActiveGuard({ id: 'g1', name: 'Marta' });

    component.openModal();
    component.selectedPerson.set({ faceId: 'job-1_2', appearance: FACES[1] });
    component.reason.set('Motivo');
    component.createMarked();

    expect(api.createMarked).toHaveBeenCalledWith({
      faceId: 'job-1_2',
      reason: 'Motivo',
      createdByGuardId: 'g1'
    });
  });

  it('ends the session and goes to the guard selection when the guard no longer exists', async () => {
    api.createMarked.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { status: 400, message: 'El vigilante no existe' }
      }))
    );
    await create();
    const navigateByUrl = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    const session = TestBed.inject(SessionService);
    session.setActiveGuard({ id: 'g-borrado', name: 'Marta' });

    component.openModal();
    component.selectedPerson.set({ faceId: 'job-1_2', appearance: FACES[1] });
    component.reason.set('Motivo');
    component.createMarked();
    await fixture.whenStable();

    expect(session.getActiveGuard()).toBeNull();
    expect(session.notice()).toContain('Selecciona de nuevo el vigilante');
    expect(navigateByUrl).toHaveBeenCalledWith('/guards');
    expect(component.busy()).toBe(false);
  });

  it('refetches the detection images after ten minutes keeping the current ones, and stops on destroy', async () => {
    vi.useFakeTimers();
    await create();
    expect(api.getFaceAppearances).toHaveBeenCalledTimes(1);

    const pending = new Subject<unknown[]>();
    api.getFaceAppearances.mockReturnValue(pending);

    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    expect(api.getFaceAppearances).toHaveBeenCalledTimes(2);
    expect(component.people().length).toBe(2);

    pending.next([FACES[0]]);
    pending.complete();
    expect(component.people().length).toBe(1);

    fixture.destroy();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(api.getFaceAppearances).toHaveBeenCalledTimes(2);
  });
});
