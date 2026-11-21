import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../../core/services/session.service';
import { DetectionMatches, MatchDetection } from '../../../core/models/face-match';
import { DetectionMatchesComponent } from './detection-matches';

function detection(faceId: string, timestamp: string, score: number | null = null): MatchDetection {
  return {
    faceId,
    jobId: faceId.split('_')[0],
    cameraId: 'CAM-02',
    cameraName: 'Garaje',
    videoName: 'garaje.mp4',
    timestamp,
    capturedAt: '2026-10-16T10:05:21',
    score,
    frameUrl: `https://x/${faceId}.jpg`
  };
}

const CONFIRMED: DetectionMatches = {
  faceId: 'job-1_4',
  links: [
    { id: 'm1', faceIdA: 'job-1_4', faceIdB: 'job-2_7', createdAt: '2026-10-16T10:00:00' },
    { id: 'm2', faceIdA: 'job-1_4', faceIdB: 'job-2_7', createdAt: '2026-10-16T11:00:00' },
    { id: 'm3', faceIdA: 'job-0_1', faceIdB: 'job-1_4', createdAt: '2026-10-16T09:00:00' }
  ],
  detections: [
    detection('job-0_1', '00:00:10'),
    detection('job-1_4', '00:01:23'),
    detection('job-2_7', '00:02:00')
  ]
};

const CANDIDATES = [detection('job-3_2', '00:00:05', 0.8213), detection('job-3_9', '00:00:09', 0.7)];

describe('DetectionMatchesComponent', () => {
  let fixture: ComponentFixture<DetectionMatchesComponent>;
  let api: {
    getCandidates: ReturnType<typeof vi.fn>;
    getDetectionMatches: ReturnType<typeof vi.fn>;
    decideMatch: ReturnType<typeof vi.fn>;
    undoMatch: ReturnType<typeof vi.fn>;
  };
  let opened: string[];
  let changed: number;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DetectionMatchesComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DetectionMatchesComponent);
    fixture.componentRef.setInput('faceId', 'job-1_4');
    fixture.componentInstance.openDetection.subscribe(id => opened.push(id));
    fixture.componentInstance.changed.subscribe(() => changed++);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function root(): HTMLElement {
    return fixture.nativeElement;
  }

  function text(): string {
    return root().textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(root().querySelectorAll('button')).find(
      candidate => candidate.textContent?.trim() === label
    );
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function search(): Promise<void> {
    button('Buscar')!.click();
    await settle();
  }

  beforeEach(() => {
    opened = [];
    changed = 0;
    localStorage.setItem('activeGuard', JSON.stringify({ id: 'g1', name: 'Ana' }));
    api = {
      getCandidates: vi.fn(() => of(CANDIDATES)),
      getDetectionMatches: vi.fn(() => of(CONFIRMED)),
      decideMatch: vi.fn(() => of({ id: 'new' })),
      undoMatch: vi.fn(() => of(undefined))
    };
  });

  afterEach(() => localStorage.clear());

  it('loads and lists confirmed matches in time order', async () => {
    await create();

    expect(text()).toContain('Coincidencias confirmadas (2)');
    const items = Array.from(root().querySelectorAll('.confirmed-list .match-time')).map(
      item => item.textContent?.trim()
    );
    expect(items).toEqual(['00:00:10', '00:01:23', '00:02:00']);
    expect(api.getDetectionMatches).toHaveBeenCalledWith('job-1_4');
  });

  it('shows empty confirmed text', async () => {
    api.getDetectionMatches.mockReturnValue(
      of({ faceId: 'job-1_4', links: [], detections: [detection('job-1_4', '00:01:23')] })
    );
    await create();

    expect(text()).toContain('Coincidencias confirmadas (0)');
    expect(text()).toContain('Sin coincidencias confirmadas');
  });

  it('shows the loading and error states of the confirmed block with Reintentar', async () => {
    api.getDetectionMatches.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Falla' } }))
    );
    await create();

    expect(text()).toContain('Falla');
    button('Reintentar')!.click();
    await settle();

    expect(text()).toContain('Coincidencias confirmadas (2)');
  });

  it('searches candidates only after Buscar', async () => {
    await create();
    expect(api.getCandidates).not.toHaveBeenCalled();

    await search();

    expect(api.getCandidates).toHaveBeenCalledWith('job-1_4');
    expect(text()).toContain('Posibles coincidencias en otras cámaras');
    expect(text()).toContain('similitud 0,82');
    expect(text()).toContain('similitud 0,70');
  });

  it('shows the empty candidates text', async () => {
    api.getCandidates.mockReturnValue(of([]));
    await create();
    await search();

    expect(text()).toContain('No hay detecciones de otros videos con embedding');
  });

  it('confirm sends confirmada with the score and reloads confirmed', async () => {
    await create();
    await search();
    api.getDetectionMatches.mockClear();

    button('Confirmar')!.click();
    await settle();

    expect(api.decideMatch).toHaveBeenCalledWith({
      faceIdA: 'job-1_4',
      faceIdB: 'job-3_2',
      decision: 'confirmada',
      score: 0.8213,
      createdByGuardId: 'g1'
    });
    expect(api.getDetectionMatches).toHaveBeenCalledTimes(1);
    expect(text()).not.toContain('similitud 0,82');
    expect(changed).toBe(1);
  });

  it('discard removes the candidate from the list', async () => {
    await create();
    await search();
    api.getDetectionMatches.mockClear();

    button('Descartar')!.click();
    await settle();

    expect(api.decideMatch).toHaveBeenCalledWith(
      expect.objectContaining({ faceIdB: 'job-3_2', decision: 'descartada' })
    );
    expect(text()).not.toContain('similitud 0,82');
    expect(text()).toContain('similitud 0,70');
    expect(api.getDetectionMatches).not.toHaveBeenCalled();
    expect(changed).toBe(1);
  });

  const CHAIN: DetectionMatches = {
    faceId: 'job-1_4',
    links: [
      { id: 'l1', faceIdA: 'job-0_1', faceIdB: 'job-1_4', createdAt: '2026-10-16T09:00:00' },
      { id: 'l2', faceIdA: 'job-0_1', faceIdB: 'job-2_7', createdAt: '2026-10-16T10:00:00' }
    ],
    detections: [
      detection('job-0_1', '00:00:10'),
      detection('job-1_4', '00:01:23'),
      detection('job-2_7', '00:02:00')
    ]
  };

  it('quitar on a middle detection of a chain removes all its links', async () => {
    api.getDetectionMatches.mockReturnValue(of(CHAIN));
    await create();
    api.getDetectionMatches.mockClear();

    root().querySelectorAll<HTMLButtonElement>('.confirmed-list button.undo-button')[0].click();
    await settle();

    expect(api.undoMatch).toHaveBeenCalledTimes(2);
    expect(api.undoMatch).toHaveBeenCalledWith('l1');
    expect(api.undoMatch).toHaveBeenCalledWith('l2');
    expect(api.getDetectionMatches).toHaveBeenCalledTimes(1);
    expect(changed).toBe(1);
  });

  it('quitar on an end detection removes only its link', async () => {
    api.getDetectionMatches.mockReturnValue(of(CHAIN));
    await create();
    api.getDetectionMatches.mockClear();

    root().querySelectorAll<HTMLButtonElement>('.confirmed-list button.undo-button')[1].click();
    await settle();

    expect(api.undoMatch).toHaveBeenCalledTimes(1);
    expect(api.undoMatch).toHaveBeenCalledWith('l2');
    expect(api.getDetectionMatches).toHaveBeenCalledTimes(1);
    expect(changed).toBe(1);
  });

  it('quitar failure shows the error and reloads', async () => {
    api.getDetectionMatches.mockReturnValue(of(CHAIN));
    api.undoMatch.mockImplementation((id: string) =>
      id === 'l2'
        ? throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Falla al quitar' } }))
        : of(undefined)
    );
    await create();
    api.getDetectionMatches.mockClear();

    root().querySelectorAll<HTMLButtonElement>('.confirmed-list button.undo-button')[0].click();
    await settle();

    expect(text()).toContain('Falla al quitar');
    expect(api.getDetectionMatches).toHaveBeenCalledTimes(1);
    expect(button('Quitando...')).toBeUndefined();
    expect(root().querySelector<HTMLButtonElement>('button.undo-button')!.disabled).toBe(false);
  });

  it('shows the 409 message inline', async () => {
    api.getCandidates.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { status: 409, message: 'La detección no tiene embedding' } })
      )
    );
    await create();
    await search();

    expect(text()).toContain('La detección no tiene embedding');
    expect(root().querySelector('.candidate-list')).toBeNull();
  });

  it('buttons show busy labels and ignore double clicks', async () => {
    const pending = new Subject<unknown>();
    api.decideMatch.mockReturnValue(pending);
    await create();
    await search();

    const confirm = button('Confirmar')!;
    confirm.click();
    confirm.click();
    await settle();

    expect(api.decideMatch).toHaveBeenCalledTimes(1);
    expect(button('Confirmando...')).toBeDefined();
    expect(button('Descartar')!.disabled).toBe(true);

    pending.next({ id: 'x' });
    pending.complete();
    await settle();

    expect(button('Confirmando...')).toBeUndefined();
  });

  it('shows Descartando and Quitando labels while pending', async () => {
    const pending = new Subject<unknown>();
    api.decideMatch.mockReturnValue(pending);
    api.undoMatch.mockReturnValue(new Subject<unknown>());
    await create();
    await search();

    button('Descartar')!.click();
    await settle();
    expect(button('Descartando...')).toBeDefined();
    pending.error(new HttpErrorResponse({ status: 500 }));
    await settle();

    root().querySelector<HTMLButtonElement>('button.undo-button')!.click();
    await settle();
    expect(button('Quitando...')).toBeDefined();
  });

  it('clicking a face emits openDetection', async () => {
    await create();

    root().querySelector<HTMLButtonElement>('.confirmed-list .match-face')!.click();
    expect(opened).toEqual(['job-0_1']);

    await search();
    root().querySelector<HTMLButtonElement>('.candidate-list .match-face')!.click();
    expect(opened).toEqual(['job-0_1', 'job-3_2']);
  });

  it('ends the session when the guard is missing', async () => {
    api.decideMatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'El vigilante no existe' } }))
    );
    await create();
    const end = vi.spyOn(TestBed.inject(SessionService), 'endIfGuardMissing');
    await search();

    button('Confirmar')!.click();
    await settle();

    expect(end).toHaveBeenCalled();
  });
});
