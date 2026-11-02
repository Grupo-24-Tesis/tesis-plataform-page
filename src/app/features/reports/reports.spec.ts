import { of, throwError } from 'rxjs';

import { Reports } from './reports';
import { ReportItem } from '../../core/models/report.model';
import { FaceAppearance } from '../../core/models/face.model';

/** PR-01 – Reportes: filtros, creación, cambio de estado y resolución (API simulada). */
describe('Reports', () => {
  let api: Record<'getReports' | 'getFilteredReports' | 'createReport' | 'updateReportStatus' | 'getFaceAppearances', ReturnType<typeof vi.fn>>;

  const report = (id: string, status: ReportItem['status'] = 'investigacion'): ReportItem => ({
    id, title: `Reporte ${id}`, status, priority: 'media', description: 'desc',
    incidentDate: '2026-10-05T10:00', createdAt: '2026-10-05T11:00', faceIds: [],
  });
  const appearance = (faceId: string, frameUrl?: string): FaceAppearance => ({ faceId, timestamp: '00:00:01', cameraId: 'c1', frameUrl });

  const create = () => {
    const component = new Reports(api as any);
    component.ngOnInit();
    return component;
  };

  const selectEvent = (value: string) => {
    const select = { value } as HTMLSelectElement;
    return { select, event: { target: select } as unknown as Event };
  };

  beforeEach(() => {
    api = {
      getReports: vi.fn().mockReturnValue(of([report('r1'), report('r2', 'solucionado')])),
      getFilteredReports: vi.fn().mockReturnValue(of([])),
      createReport: vi.fn(),
      updateReportStatus: vi.fn(),
      getFaceAppearances: vi.fn().mockReturnValue(of([])),
    };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe('carga inicial', () => {
    it('carga reportes y apariciones', () => {
      api.getFaceAppearances.mockReturnValue(of([appearance('f1')]));

      const component = create();

      expect(component.reports()).toHaveLength(2);
      expect(component.appearances()).toHaveLength(1);
    });

    it('si fallan las APIs no rompe', () => {
      api.getReports.mockReturnValue(throwError(() => new Error('x')));
      api.getFaceAppearances.mockReturnValue(throwError(() => new Error('x')));

      const component = create();

      expect(component.reports()).toEqual([]);
      expect(component.appearances()).toEqual([]);
    });

    it('getReportsByStatus separa en investigación y solucionados', () => {
      const component = create();

      expect(component.getReportsByStatus('investigacion').map(r => r.id)).toEqual(['r1']);
      expect(component.getReportsByStatus('solucionado').map(r => r.id)).toEqual(['r2']);
    });

    it('define las dos secciones de reportes', () => {
      expect(create().reportSections.map(s => s.status)).toEqual(['investigacion', 'solucionado']);
    });
  });

  describe('applyFilters', () => {
    it('sin filtros consulta solo con dateType por defecto', () => {
      const component = create();

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, 'incidente');
    });

    it('filtra por estado y tipo de fecha', () => {
      const component = create();
      component.statusFilter = 'solucionado';
      component.dateType = 'resolucion';

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith('solucionado', undefined, undefined, undefined, 'resolucion');
    });

    it('filtro "día" envía la fecha seleccionada', () => {
      const component = create();
      component.dateFilter = 'dia';
      component.selectedDate = '2026-10-05';

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith(undefined, '2026-10-05', undefined, undefined, 'incidente');
    });

    it('filtro "día" sin fecha elegida no envía fechas', () => {
      const component = create();
      component.dateFilter = 'dia';

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, 'incidente');
    });

    it.each([
      ['2026-02', '2026-02-01', '2026-02-28'],
      ['2028-02', '2028-02-01', '2028-02-29'], // año bisiesto
      ['2026-10', '2026-10-01', '2026-10-31'],
      ['2026-12', '2026-12-01', '2026-12-31'],
      ['2026-04', '2026-04-01', '2026-04-30'],
    ])('filtro "mes" %s -> %s a %s', (month, start, end) => {
      const component = create();
      component.dateFilter = 'mes';
      component.selectedMonth = month;

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith(undefined, undefined, start, end, 'incidente');
    });

    it('filtro "año" va de enero 1 a diciembre 31', () => {
      const component = create();
      component.dateFilter = 'ano';
      component.selectedYear = '2026';

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith(undefined, undefined, '2026-01-01', '2026-12-31', 'incidente');
    });

    it('filtro "rango" necesita inicio y fin', () => {
      const component = create();
      component.dateFilter = 'rango';
      component.startDate = '2026-10-01';
      component.endDate = '2026-10-10';

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith(undefined, undefined, '2026-10-01', '2026-10-10', 'incidente');
    });

    it('filtro "rango" incompleto no envía fechas', () => {
      const component = create();
      component.dateFilter = 'rango';
      component.startDate = '2026-10-01';

      component.applyFilters();

      expect(api.getFilteredReports).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, 'incidente');
    });

    it('reemplaza la lista con el resultado filtrado', () => {
      api.getFilteredReports.mockReturnValue(of([report('r9')]));
      const component = create();

      component.applyFilters();

      expect(component.reports().map(r => r.id)).toEqual(['r9']);
    });

    it('si falla el filtrado conserva la lista actual', () => {
      api.getFilteredReports.mockReturnValue(throwError(() => new Error('x')));
      const component = create();

      component.applyFilters();

      expect(component.reports()).toHaveLength(2);
    });

    it('clearFilters reinicia todos los campos y recarga todos los reportes', () => {
      const component = create();
      component.statusFilter = 'solucionado';
      component.dateType = 'resolucion';
      component.dateFilter = 'mes';
      component.selectedDate = '2026-10-05';
      component.selectedMonth = '2026-10';
      component.selectedYear = '2026';
      component.startDate = 'a';
      component.endDate = 'b';

      component.clearFilters();

      expect(component.statusFilter).toBe('');
      expect(component.dateType).toBe('incidente');
      expect(component.dateFilter).toBe('');
      expect([component.selectedDate, component.selectedMonth, component.selectedYear, component.startDate, component.endDate]).toEqual(['', '', '', '', '']);
      expect(api.getReports).toHaveBeenCalledTimes(2);
    });
  });

  describe('crear reporte', () => {
    const fillValid = (component: Reports) => {
      component.newReport.title = 'Robo en entrada';
      component.newReport.description = 'Se llevaron un equipo';
      component.newReport.incidentDate = '2026-10-05T10:00';
    };

    it('openModal reinicia el formulario y muestra el modal', () => {
      const component = create();
      component.newReport.title = 'viejo';
      component.newReport.faceIds = ['f1'];

      component.openModal();

      expect(component.showModal).toBe(true);
      expect(component.newReport.title).toBe('');
      expect(component.newReport.faceIds).toEqual([]);
      expect(component.newReport.status).toBe('investigacion');
      expect(component.newReport.priority).toBe('media');
    });

    it('closeModal oculta el modal', () => {
      const component = create();
      component.showModal = true;

      component.closeModal();

      expect(component.showModal).toBe(false);
    });

    it.each([
      ['título vacío', (c: Reports) => (c.newReport.title = '   ')],
      ['descripción vacía', (c: Reports) => (c.newReport.description = '')],
      ['sin fecha de incidente', (c: Reports) => (c.newReport.incidentDate = '')],
    ])('no crea el reporte con %s', (_name, breakIt) => {
      const component = create();
      fillValid(component);
      breakIt(component);

      component.createReport();

      expect(api.createReport).not.toHaveBeenCalled();
    });

    it('crea el reporte, lo agrega a la lista y cierra el modal', () => {
      const created = report('r3');
      api.createReport.mockReturnValue(of(created));
      const component = create();
      component.openModal();
      fillValid(component);

      component.createReport();

      expect(api.createReport).toHaveBeenCalledWith(expect.objectContaining({ title: 'Robo en entrada' }));
      expect(component.reports()).toContainEqual(created);
      expect(component.showModal).toBe(false);
    });

    it('si falla la API el modal sigue abierto y la lista no cambia', () => {
      api.createReport.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      component.openModal();
      fillValid(component);

      component.createReport();

      expect(component.showModal).toBe(true);
      expect(component.reports()).toHaveLength(2);
    });
  });

  describe('cambiar estado', () => {
    it('elegir "solucionado" abre el modal de resolución sin llamar a la API', () => {
      const component = create();
      const r = report('r1');
      const { select, event } = selectEvent('solucionado');

      component.updateStatus(r, event);

      expect(component.resolutionModal).toBe(true);
      expect(component.selectedReport).toBe(r);
      expect(select.value).toBe('investigacion'); // el select vuelve al estado actual
      expect(api.updateReportStatus).not.toHaveBeenCalled();
    });

    it('otro estado llama a la API y reemplaza el reporte en la lista', () => {
      const updated = { ...report('r2'), status: 'investigacion' as const, title: 'Actualizado' };
      api.updateReportStatus.mockReturnValue(of(updated));
      const component = create();
      const { event } = selectEvent('investigacion');

      component.updateStatus(report('r2', 'solucionado'), event);

      expect(api.updateReportStatus).toHaveBeenCalledWith('r2', 'investigacion');
      expect(component.reports().find(r => r.id === 'r2')?.title).toBe('Actualizado');
      expect(component.reports()).toHaveLength(2);
    });

    it('si falla la API el select vuelve al estado anterior', () => {
      api.updateReportStatus.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      const { select, event } = selectEvent('investigacion');

      component.updateStatus(report('r2', 'solucionado'), event);

      expect(select.value).toBe('solucionado');
    });
  });

  describe('resolución', () => {
    const openResolution = (component: Reports, r = report('r1')) => {
      component.selectedReport = r;
      component.resolutionModal = true;
    };

    it('confirmResolution sin reporte seleccionado no hace nada', () => {
      const component = create();
      component.resolutionData = { resolvedAt: '2026-10-06T12:00', resolutionDescription: 'ok' };

      component.confirmResolution();

      expect(api.updateReportStatus).not.toHaveBeenCalled();
    });

    it.each([
      ['sin fecha', { resolvedAt: '', resolutionDescription: 'Resuelto' }],
      ['sin descripción', { resolvedAt: '2026-10-06T12:00', resolutionDescription: '' }],
      ['descripción solo espacios', { resolvedAt: '2026-10-06T12:00', resolutionDescription: '   ' }],
    ])('confirmResolution %s no llama a la API', (_name, data) => {
      const component = create();
      openResolution(component);
      component.resolutionData = data;

      component.confirmResolution();

      expect(api.updateReportStatus).not.toHaveBeenCalled();
      expect(component.resolutionModal).toBe(true);
    });

    it('confirmResolution marca solucionado con fecha y descripción, actualiza la lista y cierra', () => {
      const updated = { ...report('r1'), status: 'solucionado' as const, resolutionDescription: 'Resuelto' };
      api.updateReportStatus.mockReturnValue(of(updated));
      const component = create();
      openResolution(component);
      component.resolutionData = { resolvedAt: '2026-10-06T12:00', resolutionDescription: 'Resuelto' };

      component.confirmResolution();

      expect(api.updateReportStatus).toHaveBeenCalledWith('r1', 'solucionado', '2026-10-06T12:00', 'Resuelto');
      expect(component.reports().find(r => r.id === 'r1')?.status).toBe('solucionado');
      expect(component.resolutionModal).toBe(false);
      expect(component.selectedReport).toBeNull();
    });

    it('si falla la API el modal de resolución sigue abierto', () => {
      api.updateReportStatus.mockReturnValue(throwError(() => new Error('x')));
      const component = create();
      openResolution(component);
      component.resolutionData = { resolvedAt: '2026-10-06T12:00', resolutionDescription: 'Resuelto' };

      component.confirmResolution();

      expect(component.resolutionModal).toBe(true);
    });

    it('closeResolutionModal limpia todo', () => {
      const component = create();
      openResolution(component);
      component.resolutionData = { resolvedAt: 'x', resolutionDescription: 'y' };

      component.closeResolutionModal();

      expect(component.resolutionModal).toBe(false);
      expect(component.selectedReport).toBeNull();
      expect(component.resolutionData).toEqual({ resolvedAt: '', resolutionDescription: '' });
    });
  });

  describe('personas del reporte', () => {
    it('uniquePeople deja una sola aparición por faceId (la primera)', () => {
      api.getFaceAppearances.mockReturnValue(of([
        appearance('f1', 'url-1a'), appearance('f2', 'url-2'), appearance('f1', 'url-1b'),
      ]));
      const component = create();

      const people = component.uniquePeople;

      expect(people.map(p => p.faceId)).toEqual(['f1', 'f2']);
      expect(people[0].appearance.frameUrl).toBe('url-1a');
    });

    it('toggleFace agrega y quita caras del reporte nuevo', () => {
      const component = create();

      component.toggleFace('f1');
      component.toggleFace('f2');
      expect(component.newReport.faceIds).toEqual(['f1', 'f2']);
      expect(component.isFaceSelected('f1')).toBe(true);

      component.toggleFace('f1');
      expect(component.newReport.faceIds).toEqual(['f2']);
      expect(component.isFaceSelected('f1')).toBe(false);
    });

    it('getPersonImage devuelve la URL o cadena vacía', () => {
      api.getFaceAppearances.mockReturnValue(of([appearance('f1', 'url-1'), appearance('f2')]));
      const component = create();

      expect(component.getPersonImage('f1')).toBe('url-1');
      expect(component.getPersonImage('f2')).toBe('');
      expect(component.getPersonImage('zzz')).toBe('');
    });
  });
});
