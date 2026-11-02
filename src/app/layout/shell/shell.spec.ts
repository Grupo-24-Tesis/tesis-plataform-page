import { Shell } from './shell';
import { SessionService } from '../../core/services/session.service';

/** PR-01 – Layout principal: nombre del vigilante, menú y cierre de sesión. */
describe('Shell', () => {
  let session: SessionService;
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  const create = () => new Shell(session, router as any);

  beforeEach(() => {
    localStorage.clear();
    session = new SessionService();
    router = { navigateByUrl: vi.fn() };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('muestra "Vigilante" cuando no hay vigilante guardado', () => {
    const shell = create();
    shell.ngOnInit();

    expect(shell.guardName).toBe('Vigilante');
  });

  it('muestra el nombre del vigilante activo', () => {
    localStorage.setItem('facecluster-active-guard', JSON.stringify({ id: '1', name: 'Ana Pérez' }));
    const shell = create();

    shell.ngOnInit();

    expect(shell.guardName).toBe('Ana Pérez');
  });

  it('usa "Vigilante" si el objeto guardado no trae nombre', () => {
    localStorage.setItem('facecluster-active-guard', JSON.stringify({ id: '1' }));
    const shell = create();

    shell.ngOnInit();

    expect(shell.guardName).toBe('Vigilante');
  });

  it('si el JSON guardado está dañado conserva el nombre por defecto y avisa', () => {
    localStorage.setItem('facecluster-active-guard', '{no-es-json');
    const shell = create();

    shell.ngOnInit();

    expect(shell.guardName).toBe('Vigilante');
    expect(console.warn).toHaveBeenCalled();
  });

  it('toggleMenu alterna y closeMenu cierra', () => {
    const shell = create();
    expect(shell.menuOpen).toBe(false);

    shell.toggleMenu();
    expect(shell.menuOpen).toBe(true);
    shell.toggleMenu();
    expect(shell.menuOpen).toBe(false);

    shell.toggleMenu();
    shell.closeMenu();
    expect(shell.menuOpen).toBe(false);
  });

  it('logout borra la sesión y vuelve a /guards', () => {
    session.setActiveGuard('g1');
    localStorage.setItem('facecluster-active-guard', JSON.stringify({ id: 'g1', name: 'Ana' }));
    const shell = create();

    shell.logout();

    expect(session.getActiveGuard()).toBeNull();
    expect(localStorage.getItem('facecluster-active-guard')).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/guards');
  });
});
