import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiService, Guard } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { Guards } from './guards';

describe('Guards', () => {
  let component: Guards;
  let fixture: ComponentFixture<Guards>;
  let api: {
    getGuards: ReturnType<typeof vi.fn>;
    createGuard: ReturnType<typeof vi.fn>;
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Guards],
      providers: [
        { provide: ApiService, useValue: api },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Guards);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    api = {
      getGuards: vi.fn(() => of([])),
      createGuard: vi.fn()
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('should create', async () => {
    await create();

    expect(component).toBeTruthy();
  });

  it('shows the empty text after an empty load', async () => {
    await create();

    expect(text()).toContain('No hay vigilantes registrados.');
  });

  it('shows the load error without the empty text', async () => {
    api.getGuards.mockReturnValue(throwError(() => new Error('sin backend')));

    await create();

    expect(text()).toContain('No se pudieron cargar los vigilantes.');
    expect(text()).not.toContain('No hay vigilantes registrados.');
  });

  it('keeps the load error when the dialog is opened', async () => {
    api.getGuards.mockReturnValue(throwError(() => new Error('sin backend')));
    await create();

    component.openGuardDialog();
    await fixture.whenStable();

    expect(component.loadErrorMsg()).toBe('No se pudieron cargar los vigilantes.');
    expect(fixture.nativeElement.querySelector('.aviso').textContent)
      .toContain('No se pudieron cargar los vigilantes.');
    expect(fixture.nativeElement.querySelector('.modal-guardia .error')).toBeNull();
  });

  it('sends one guard request on a double submit and disables the button meanwhile', async () => {
    const pending = new Subject<Guard>();
    api.createGuard.mockReturnValue(pending);
    await create();
    component.openGuardDialog();
    component.newGuardName = 'Laura Martínez';

    component.addGuard();
    component.addGuard();
    await fixture.whenStable();

    expect(api.createGuard).toHaveBeenCalledTimes(1);
    const submit: HTMLButtonElement =
      fixture.nativeElement.querySelector('.modal-guardia button[type="submit"]');
    expect(submit.disabled).toBe(true);

    pending.next({ id: 'g1', name: 'Laura Martínez', shift: 'Sin asignar', schedule: 'Horario no definido' });
    await fixture.whenStable();

    expect(component.saving()).toBe(false);
    expect(submit.disabled).toBe(false);
    expect(text()).toContain('Laura Martínez');
  });

  it('shows the backend message inside the dialog when the guard cannot be created', async () => {
    api.createGuard.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { status: 409, message: 'El registro ya existe' }
      }))
    );
    await create();
    component.openGuardDialog();
    component.newGuardName = 'Laura Martínez';

    component.addGuard();
    await fixture.whenStable();

    expect(component.saving()).toBe(false);
    expect(fixture.nativeElement.querySelector('.modal-guardia .error').textContent)
      .toContain('El registro ya existe');
    expect(fixture.nativeElement.querySelector('.aviso')).toBeNull();
  });

  it('shows inline why the guard must be selected again and clears it when a shift starts', async () => {
    api.getGuards.mockReturnValue(of([{ id: 'g2', name: 'Marta', shift: '', schedule: '' }]));
    await create();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const session = TestBed.inject(SessionService);

    session.endIfGuardMissing(new HttpErrorResponse({
      status: 400,
      error: { status: 400, message: 'El vigilante no existe' }
    }));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.sesion-terminada').textContent)
      .toContain('Selecciona de nuevo el vigilante');

    component.selectGuard(component.guards()[0]);
    component.startShift();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.sesion-terminada')).toBeNull();
  });
});
