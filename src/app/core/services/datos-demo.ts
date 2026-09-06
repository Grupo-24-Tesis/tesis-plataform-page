import {PLATFORM_ID, Injectable, computed, effect, inject, signal} from '@angular/core';

import { isPlatformBrowser } from '@angular/common';

export interface Camara {
  id: string;
  nombre: string;
}

export interface Aparicion {
  id: string;
  videoId: string;
  camaraId: string;
  fecha: string;
  hora: string;
  confianza: number;
}

export interface GrupoFacial {
  id: string;
  nombre: string;
  color: string;
  apariciones: Aparicion[];
}

export interface Grabacion {
  id: string;
  camaraId: string;
  archivo: string;
  fecha: string;
  inicio: string;
  fin: string;
  estado?: 'procesando' | 'completado';
}

export type EstadoReporte =
  | 'investigacion'
  | 'solucionado';

export type PrioridadReporte =
  | 'alta'
  | 'media'
  | 'baja';

export interface Reporte {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  estado: EstadoReporte;
  prioridad: PrioridadReporte;
  creadoPor: string;
  camaras: string[];
  gruposVinculados: string[];
}

/*
 * Describe los datos que se conservarán en el navegador.
 */
interface EstadoPersistido {
  camaras: Camara[];
  grabaciones: Grabacion[];
  reportes: Reporte[];
  idsGuardados: string[];
  idsMarcados: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DatosDemo {
  /*
   * Nombre utilizado para guardar los datos en localStorage.
   * La versión permite cambiar la estructura en el futuro.
   */
  private readonly claveLocalStorage =
    'facecluster-estado-demo-v1';

  /*
   * Esta comprobación evita errores si Angular ejecuta
   * alguna parte de la aplicación fuera del navegador.
   */
  private readonly plataformaId = inject(PLATFORM_ID);

  private readonly esNavegador =
    isPlatformBrowser(this.plataformaId);

  readonly camaras = signal<Camara[]>([
    {
      id: 'CAM-01',
      nombre: 'Entrada Principal'
    },
    {
      id: 'CAM-02',
      nombre: 'Parqueadero A'
    },
    {
      id: 'CAM-03',
      nombre: 'Zona Común Piscina'
    },
    {
      id: 'CAM-04',
      nombre: 'Torre B - Lobby'
    },
    {
      id: 'CAM-05',
      nombre: 'Torre A - Lobby'
    },
    {
      id: 'CAM-06',
      nombre: 'Salida Vehicular'
    },
    {
      id: 'CAM-07',
      nombre: 'Cuarto de Bombas'
    },
    {
      id: 'CAM-08',
      nombre: 'Cancha Múltiple'
    }
    ]);

  readonly grabaciones = signal<Grabacion[]>([
    {
      id: 'VID-001',
      camaraId: 'CAM-01',
      archivo: 'cam01_manana.mp4',
      fecha: '2026-08-07',
      inicio: '08:00',
      fin: '10:30'
    },
    {
      id: 'VID-002',
      camaraId: 'CAM-01',
      archivo: 'cam01_tarde.mp4',
      fecha: '2026-08-08',
      inicio: '14:00',
      fin: '16:00'
    },
    {
      id: 'VID-003',
      camaraId: 'CAM-02',
      archivo: 'cam02_manana.mp4',
      fecha: '2026-08-07',
      inicio: '08:00',
      fin: '10:00'
    }
  ]);

  readonly grupos = signal<GrupoFacial[]>([
    {
      id: 'P-001',
      nombre: 'Grupo #001',
      color: '#3b82f6',
      apariciones: [
        {
          id: 'AP-001',
          videoId: 'VID-001',
          camaraId: 'CAM-01',
          fecha: '2026-08-07',
          hora: '08:14',
          confianza: 94
        },
        {
          id: 'AP-002',
          videoId: 'VID-003',
          camaraId: 'CAM-02',
          fecha: '2026-08-07',
          hora: '08:22',
          confianza: 89
        }
      ]
    },
    {
      id: 'P-002',
      nombre: 'Grupo #002',
      color: '#ec4899',
      apariciones: [
        {
          id: 'AP-003',
          videoId: 'VID-003',
          camaraId: 'CAM-02',
          fecha: '2026-08-07',
          hora: '08:45',
          confianza: 87
        },
        {
          id: 'AP-004',
          videoId: 'VID-002',
          camaraId: 'CAM-01',
          fecha: '2026-08-08',
          hora: '14:10',
          confianza: 82
        }
      ]
    },
    {
      id: 'P-003',
      nombre: 'Grupo #003',
      color: '#8b5cf6',
      apariciones: [
        {
          id: 'AP-005',
          videoId: 'VID-001',
          camaraId: 'CAM-01',
          fecha: '2026-08-07',
          hora: '09:10',
          confianza: 96
        },
        {
          id: 'AP-006',
          videoId: 'VID-003',
          camaraId: 'CAM-02',
          fecha: '2026-08-07',
          hora: '09:14',
          confianza: 93
        }
      ]
    }
  ]);

  private readonly idsGuardados =
    signal<string[]>([]);

  private readonly idsMarcados =
    signal<string[]>([]);

  readonly gruposGuardados = computed(() =>
    this.grupos().filter(grupo =>
      this.idsGuardados().includes(grupo.id)
    )
  );

  readonly reportes = signal<Reporte[]>([
    {
      id: 'REP-2026-001',
      titulo:
        'Ingreso sospechoso - Cuarto de Bombas',
      descripcion:
        'El día 07/08 a las 02:14 se detectó un individuo no identificado accediendo al cuarto de bombas. Se requiere revisar las apariciones y verificar si hubo daños en las instalaciones.',
      fecha: '2026-08-07',
      estado: 'investigacion',
      prioridad: 'alta',
      creadoPor: 'Carlos Ramírez',
      camaras: ['CAM-07', 'CAM-01'],
      gruposVinculados: ['P-001']
    },
    {
      id: 'REP-2026-002',
      titulo:
        'Vehículo abandonado - Parqueadero A',
      descripcion:
        'Un vehículo permanece estacionado sin autorización durante más de 72 horas. Se solicitó revisión por parte de la administración.',
      fecha: '2026-08-05',
      estado: 'investigacion',
      prioridad: 'media',
      creadoPor: 'Andrés Torres',
      camaras: ['CAM-02'],
      gruposVinculados: []
    },
    {
      id: 'REP-2026-003',
      titulo: 'Riña en zona común',
      descripcion:
        'Se reportó un altercado entre residentes en la zona de piscina. Las apariciones relevantes fueron recopiladas para revisión.',
      fecha: '2026-08-01',
      estado: 'solucionado',
      prioridad: 'media',
      creadoPor: 'Carlos Ramírez',
      camaras: ['CAM-03'],
      gruposVinculados: ['P-001', 'P-002']
    },
    {
      id: 'REP-2026-004',
      titulo:
        'Hurto de bicicleta - Parqueadero',
      descripcion:
        'Se reportó el hurto de una bicicleta en el parqueadero. El caso fue entregado a las autoridades correspondientes.',
      fecha: '2026-07-28',
      estado: 'solucionado',
      prioridad: 'alta',
      creadoPor: 'Patricia Méndez',
      camaras: [
        'CAM-02',
        'CAM-06',
        'CAM-01'
      ],
      gruposVinculados: ['P-003']
    }
  ]);

  /*
   * Al iniciar el servicio:
   *
   * 1. Recupera los datos almacenados.
   * 2. Observa las señales.
   * 3. Guarda automáticamente cada modificación.
   */
  constructor() {
    if (!this.esNavegador) {
      return;
    }

    this.restaurarEstadoLocal();

    effect(() => {
      const estado: EstadoPersistido = {
        camaras: this.camaras(),
        grabaciones: this.grabaciones(),
        reportes: this.reportes(),
        idsGuardados: this.idsGuardados(),
        idsMarcados: this.idsMarcados()
      };

      try {
        localStorage.setItem(
          this.claveLocalStorage,
          JSON.stringify(estado)
        );
      } catch (error) {
        console.warn(
          'No fue posible guardar los datos demo de FaceCluster.',
          error
        );
      }
    });
  }

  /*
   * Recupera el estado guardado.
   * Si los datos están dañados, la aplicación continúa
   * usando los valores iniciales.
   */
  private restaurarEstadoLocal(): void {
    try {
      const contenido = localStorage.getItem(
        this.claveLocalStorage
      );

      if (!contenido) {
        return;
      }

      const estado = JSON.parse(
        contenido
      ) as Partial<EstadoPersistido>;

            if (Array.isArray(estado.camaras)) {
        this.camaras.set(estado.camaras);
      }

      if (Array.isArray(estado.grabaciones)) {
        this.grabaciones.set(
          estado.grabaciones
        );
      }

      if (Array.isArray(estado.reportes)) {
        this.reportes.set(
          estado.reportes
        );
      }

      if (Array.isArray(estado.idsGuardados)) {
        const idsValidos =
          estado.idsGuardados.filter(id =>
            this.grupos().some(
              grupo => grupo.id === id
            )
          );

        this.idsGuardados.set(idsValidos);
      }

      if (Array.isArray(estado.idsMarcados)) {
        const marcadosValidos =
          estado.idsMarcados.filter(id =>
            this.idsGuardados().includes(id)
          );

        this.idsMarcados.set(marcadosValidos);
      }
    } catch (error) {
      console.warn(
        'Los datos locales de FaceCluster no eran válidos y se usarán los datos iniciales.',
        error
      );
    }
  }

  guardarGrupo(id: string): void {
    const grupoExiste = this.grupos().some(
      grupo => grupo.id === id
    );

    if (!grupoExiste) {
      return;
    }

    this.idsGuardados.update(ids =>
      ids.includes(id)
        ? ids
        : [...ids, id]
    );
  }

  estaGuardado(id: string): boolean {
    return this.idsGuardados().includes(id);
  }

  quitarGuardado(id: string): void {
    this.idsGuardados.update(ids =>
      ids.filter(actual => actual !== id)
    );

    this.idsMarcados.update(ids =>
      ids.filter(actual => actual !== id)
    );
  }

  estaMarcado(id: string): boolean {
    return this.idsMarcados().includes(id);
  }

  alternarMarca(id: string): void {
    if (!this.estaGuardado(id)) {
      return;
    }

    this.idsMarcados.update(ids =>
      ids.includes(id)
        ? ids.filter(actual => actual !== id)
        : [...ids, id]
    );
  }

  cantidadVideos(camaraId: string): number {
    return this.grabaciones().filter(
      video => video.camaraId === camaraId
    ).length;
  }

  gruposDeVideo(
    videoId: string
  ): GrupoFacial[] {
    return this.grupos().filter(grupo =>
      grupo.apariciones.some(
        aparicion =>
          aparicion.videoId === videoId
      )
    );
  }

  nombreCamara(id: string): string {
    return (
      this.camaras().find(
        camara => camara.id === id
      )?.nombre ?? id
    );
  }

    agregarCamara(nombre: string): Camara {
    const idsNumericos = this.camaras()
      .map(camara =>
        Number(camara.id.replace('CAM-', ''))
      )
      .filter(numero =>
        Number.isFinite(numero)
      );

    const siguiente =
      Math.max(...idsNumericos, 0) + 1;

    const camara: Camara = {
      id: `CAM-${String(siguiente).padStart(2, '0')}`,
      nombre: nombre.trim()
    };

    this.camaras.update(camaras => [
      ...camaras,
      camara
    ]);

    return camara;
  }

  crearReporte(
    datos: Omit<
      Reporte,
      'id' | 'fecha' | 'estado'
    >
  ): Reporte {
    const ids = this.reportes()
      .map(reporte =>
        Number(
          reporte.id.replace('REP-2026-', '')
        )
      )
      .filter(numero =>
        Number.isFinite(numero)
      );

    const siguiente =
      Math.max(...ids, 0) + 1;

    const reporte: Reporte = {
      ...datos,
      id: `REP-2026-${String(
        siguiente
      ).padStart(3, '0')}`,
      fecha: new Date()
        .toISOString()
        .slice(0, 10),
      estado: 'investigacion'
    };

    this.reportes.update(reportes => [
      reporte,
      ...reportes
    ]);

    return reporte;
  }

  cambiarEstadoReporte(
    id: string,
    estado: EstadoReporte
  ): void {
    this.reportes.update(reportes =>
      reportes.map(reporte =>
        reporte.id === id
          ? { ...reporte, estado }
          : reporte
      )
    );
  }

  actualizarCamarasReporte(
    reporteId: string,
    camaras: string[]
  ): void {
    const camarasValidas = [
      ...new Set(camaras)
    ].filter(id =>
      this.camaras().some(
        camara => camara.id === id
      )
    );

    this.reportes.update(reportes =>
      reportes.map(reporte =>
        reporte.id === reporteId
          ? {
              ...reporte,
              camaras: camarasValidas
            }
          : reporte
      )
    );
  }

  actualizarGruposReporte(
    reporteId: string,
    gruposIds: string[]
  ): void {
    const gruposValidos = [
      ...new Set(gruposIds)
    ].filter(id =>
      this.grupos().some(
        grupo => grupo.id === id
      )
    );

    /*
     * Toda persona seleccionada desde Reportes
     * se añade automáticamente a Guardados.
     */
    gruposValidos.forEach(id =>
      this.guardarGrupo(id)
    );

    this.reportes.update(reportes =>
      reportes.map(reporte =>
        reporte.id === reporteId
          ? {
              ...reporte,
              gruposVinculados:
                gruposValidos
            }
          : reporte
      )
    );
  }

  reportePorId(
    id: string
  ): Reporte | undefined {
    return this.reportes().find(
      reporte => reporte.id === id
    );
  }

  grupoPorId(
    id: string
  ): GrupoFacial | undefined {
    return this.grupos().find(
      grupo => grupo.id === id
    );
  }

  agregarGrabacion(
    datos: Omit<Grabacion, 'id'>
  ): Grabacion {
    const ids = this.grabaciones()
      .map(video =>
        Number(
          video.id.replace('VID-', '')
        )
      )
      .filter(numero =>
        Number.isFinite(numero)
      );

    const siguiente =
      Math.max(...ids, 0) + 1;

    const grabacion: Grabacion = {
      ...datos,
      id: `VID-${String(
        siguiente
      ).padStart(3, '0')}`
    };

    this.grabaciones.update(
      grabaciones => [
        ...grabaciones,
        grabacion
      ]
    );

    return grabacion;
  }

  actualizarEstadoGrabacion(
    id: string,
    estado: 'procesando' | 'completado'
  ): void {
    this.grabaciones.update(
      grabaciones =>
        grabaciones.map(grabacion =>
          grabacion.id === id
            ? {
                ...grabacion,
                estado
              }
            : grabacion
        )
    );
  }

  reportesVinculadosAlGrupo(
    grupoId: string
  ): Reporte[] {
    return this.reportes().filter(
      reporte =>
        reporte.gruposVinculados.includes(
          grupoId
        )
    );
  }

  reportesDisponiblesParaGrupo(
    grupoId: string
  ): Reporte[] {
    return this.reportes().filter(
      reporte =>
        reporte.estado === 'investigacion' &&
        !reporte.gruposVinculados.includes(
          grupoId
        )
    );
  }

  vincularGrupoAReporte(
    grupoId: string,
    reporteId: string
  ): void {
    const grupoExiste = this.grupos().some(
      grupo => grupo.id === grupoId
    );

    if (!grupoExiste) {
      return;
    }

    this.reportes.update(reportes =>
      reportes.map(reporte => {
        if (
          reporte.id !== reporteId ||
          reporte.estado !== 'investigacion' ||
          reporte.gruposVinculados.includes(
            grupoId
          )
        ) {
          return reporte;
        }

        return {
          ...reporte,
          gruposVinculados: [
            ...reporte.gruposVinculados,
            grupoId
          ]
        };
      })
    );
  }

  desvincularGrupoDeReporte(
    grupoId: string,
    reporteId: string
  ): void {
    this.reportes.update(reportes =>
      reportes.map(reporte =>
        reporte.id === reporteId
          ? {
              ...reporte,
              gruposVinculados:
                reporte.gruposVinculados.filter(
                  id => id !== grupoId
                )
            }
          : reporte
      )
    );
  }
}