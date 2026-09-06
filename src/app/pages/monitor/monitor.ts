import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Aparicion,
  DatosDemo,
  GrupoFacial
} from '../../core/services/datos-demo';

import { Guardados } from '../guardados/guardados';
import { Reportes } from '../reportes/reportes';

@Component({
  selector: 'app-monitor',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    Guardados,
    Reportes
  ],
  templateUrl: './monitor.html',
  styleUrl: './monitor.css'
})
export class Monitor {
  readonly datos = inject(DatosDemo);

  readonly vigilante = input.required<string>();
  readonly cerrarTurno = output<void>();

  readonly vista =
    signal<'monitor' | 'reportes' | 'guardados'>('monitor');

  readonly modo = signal<'camara' | 'caras'>('camara');
  readonly camaraId = signal('CAM-01');

  readonly grupoSeleccionado =
    signal<GrupoFacial | null>(null);

  readonly mensaje = signal('');
  readonly errorCarga = signal('');

  /*
   * Filtro de horario
   */
  readonly mostrandoFiltro = signal(false);
  readonly filtroActivo = signal(false);
  readonly errorFiltro = signal('');

  horaFiltroInicio = '08:00';
  horaFiltroFin = '10:00';

  /*
   * Popup de carga
   */
  readonly dialogoCarga =
    viewChild<ElementRef<HTMLDialogElement>>('dialogoCarga');
  
  /*
   * Popup para crear una nueva cámara
   */
    readonly dialogoNuevaCamara =
    viewChild<ElementRef<HTMLDialogElement>>(
      'dialogoNuevaCamara'
    );

  /*
   * Popup para vincular el grupo seleccionado a un reporte
   */
  readonly dialogoVincularMonitor =
    viewChild<ElementRef<HTMLDialogElement>>(
      'dialogoVincularMonitor'
    );

  camaraCarga = 'CAM-01';
  fechaCarga = new Date().toISOString().slice(0, 10);
  horaInicioCarga = '08:00';
  horaFinCarga = '10:00';
  archivoVideo: File | null = null;
  nombreNuevaCamara = '';

  readonly errorNuevaCamara = signal('');

  readonly camaraSeleccionada = computed(() =>
    this.datos.camaras().find(
      camara => camara.id === this.camaraId()
    ) ?? this.datos.camaras()[0]
  );

  readonly videosVisibles = computed(() =>
    this.datos.grabaciones().filter(
      video => video.camaraId === this.camaraId()
    )
  );

  readonly gruposUnicosVisibles = computed(() =>
    this.datos.grupos().filter(grupo =>
      !this.filtroActivo() ||
      grupo.apariciones.some(ap =>
        this.horaDentroDelFiltro(ap.hora)
      )
    )
  );

  readonly reportesVinculados = computed(() => {
    const grupo = this.grupoSeleccionado();

    return grupo
      ? this.datos.reportesVinculadosAlGrupo(grupo.id)
      : [];
  });

  readonly reportesDisponibles = computed(() => {
    const grupo = this.grupoSeleccionado();

    return grupo
      ? this.datos.reportesDisponiblesParaGrupo(grupo.id)
      : [];
  });

  seleccionarCamara(id: string): void {
    this.camaraId.set(id);
    this.grupoSeleccionado.set(null);
  }

  cambiarModo(modo: 'camara' | 'caras'): void {
    this.modo.set(modo);
    this.grupoSeleccionado.set(null);
  }

  abrirDetalle(grupo: GrupoFacial): void {
    this.grupoSeleccionado.set(grupo);
  }

  guardar(grupo: GrupoFacial): void {
    this.datos.guardarGrupo(grupo.id);
    this.mensaje.set(
      `${grupo.nombre} añadido a Guardados.`
    );
  }

    abrirNuevaCamara(): void {
    this.nombreNuevaCamara = '';
    this.errorNuevaCamara.set('');

    this.dialogoNuevaCamara()
      ?.nativeElement
      .showModal();
  }

  cerrarNuevaCamara(): void {
    this.dialogoNuevaCamara()
      ?.nativeElement
      .close();

    this.nombreNuevaCamara = '';
    this.errorNuevaCamara.set('');
  }

  crearCamara(): void {
    const nombre = this.nombreNuevaCamara
      .trim()
      .replace(/\s+/g, ' ');

    if (nombre.length < 3) {
      this.errorNuevaCamara.set(
        'Escribe un nombre de al menos tres caracteres.'
      );
      return;
    }

    const existe = this.datos.camaras().some(
      camara =>
        camara.nombre.toLocaleLowerCase('es') ===
        nombre.toLocaleLowerCase('es')
    );

    if (existe) {
      this.errorNuevaCamara.set(
        'Ya existe una cámara con ese nombre.'
      );
      return;
    }

    const camara =
      this.datos.agregarCamara(nombre);

    this.camaraId.set(camara.id);
    this.modo.set('camara');
    this.grupoSeleccionado.set(null);

    this.mensaje.set(
      `${camara.id} · ${camara.nombre} agregada correctamente.`
    );

    this.cerrarNuevaCamara();
  }

  /*
   * Métodos para relacionar grupos y reportes
   */

  abrirVinculacion(): void {
    if (!this.grupoSeleccionado()) {
      return;
    }

    this.dialogoVincularMonitor()?.nativeElement.showModal();
  }

  cerrarVinculacion(): void {
    this.dialogoVincularMonitor()?.nativeElement.close();
  }

  vincularAReporte(reporteId: string): void {
    const grupo = this.grupoSeleccionado();

    if (!grupo) {
      return;
    }

    this.datos.vincularGrupoAReporte(grupo.id, reporteId);

    this.mensaje.set(
      `${grupo.nombre} fue vinculado al reporte ${reporteId}.`
    );

    this.cerrarVinculacion();
  }

  desvincularDeReporte(reporteId: string): void {
    const grupo = this.grupoSeleccionado();

    if (!grupo) {
      return;
    }

    this.datos.desvincularGrupoDeReporte(
      grupo.id,
      reporteId
    );

    this.mensaje.set(
      `${grupo.nombre} fue retirado del reporte ${reporteId}.`
    );
  }

  cambiarVista(
    vista: 'monitor' | 'reportes' | 'guardados'
  ): void {
    this.vista.set(vista);
    this.grupoSeleccionado.set(null);
    this.mensaje.set('');
  }

  /*
   * Métodos del filtro
   */

  alternarFiltro(): void {
    this.mostrandoFiltro.update(valor => !valor);
    this.errorFiltro.set('');
  }

  aplicarFiltro(): void {
    if (!this.horaFiltroInicio || !this.horaFiltroFin) {
      this.errorFiltro.set(
        'Debes seleccionar ambas horas.'
      );
      return;
    }

    if (this.horaFiltroInicio >= this.horaFiltroFin) {
      this.errorFiltro.set(
        'La hora final debe ser posterior a la hora inicial.'
      );
      return;
    }

    this.filtroActivo.set(true);
    this.errorFiltro.set('');
    this.grupoSeleccionado.set(null);

    this.mensaje.set(
      `Mostrando apariciones entre ${this.horaFiltroInicio} y ${this.horaFiltroFin}.`
    );
  }

  limpiarFiltro(): void {
    this.filtroActivo.set(false);
    this.errorFiltro.set('');
    this.grupoSeleccionado.set(null);
    this.mensaje.set('Filtro de horario eliminado.');
  }

  horaDentroDelFiltro(hora: string): boolean {
    if (!this.filtroActivo()) {
      return true;
    }

    return (
      hora >= this.horaFiltroInicio &&
      hora <= this.horaFiltroFin
    );
  }

  gruposVisiblesDeVideo(videoId: string): GrupoFacial[] {
    return this.datos
      .gruposDeVideo(videoId)
      .filter(grupo =>
        grupo.apariciones.some(ap =>
          ap.videoId === videoId &&
          this.horaDentroDelFiltro(ap.hora)
        )
      );
  }

  aparicionesVisibles(
    grupo: GrupoFacial,
    videoId: string | null
  ): Aparicion[] {
    return grupo.apariciones.filter(ap =>
      (!videoId || ap.videoId === videoId) &&
      this.horaDentroDelFiltro(ap.hora)
    );
  }

  /*
   * Métodos de carga de videos
   */

  abrirCarga(): void {
    this.camaraCarga =
      this.modo() === 'camara'
        ? this.camaraId()
        : 'CAM-01';

    this.fechaCarga = new Date().toISOString().slice(0, 10);
    this.horaInicioCarga = '08:00';
    this.horaFinCarga = '10:00';
    this.archivoVideo = null;
    this.errorCarga.set('');

    this.dialogoCarga()?.nativeElement.showModal();
  }

  cerrarCarga(): void {
    this.dialogoCarga()?.nativeElement.close();
    this.archivoVideo = null;
    this.errorCarga.set('');
  }

  seleccionarArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (!archivo) {
      this.archivoVideo = null;
      return;
    }

    if (
      archivo.type &&
      !archivo.type.startsWith('video/')
    ) {
      this.archivoVideo = null;
      input.value = '';

      this.errorCarga.set(
        'Selecciona un archivo de video válido.'
      );

      return;
    }

    this.archivoVideo = archivo;
    this.errorCarga.set('');
  }

  confirmarCarga(): void {
    if (!this.archivoVideo) {
      this.errorCarga.set('Selecciona un archivo de video.');
      return;
    }

    if (!this.camaraCarga) {
      this.errorCarga.set('Selecciona una cámara.');
      return;
    }

    if (!this.fechaCarga) {
      this.errorCarga.set('Selecciona la fecha del video.');
      return;
    }

    if (!this.horaInicioCarga || !this.horaFinCarga) {
      this.errorCarga.set(
        'Indica la hora inicial y la hora final.'
      );
      return;
    }

    if (this.horaInicioCarga >= this.horaFinCarga) {
      this.errorCarga.set(
        'La hora final debe ser posterior a la hora inicial.'
      );
      return;
    }

    const grabacion = this.datos.agregarGrabacion({
      camaraId: this.camaraCarga,
      archivo: this.archivoVideo.name,
      fecha: this.fechaCarga,
      inicio: this.horaInicioCarga,
      fin: this.horaFinCarga,
      estado: 'procesando'
    });

    this.camaraId.set(this.camaraCarga);
    this.modo.set('camara');
    this.grupoSeleccionado.set(null);

    this.mensaje.set(
      `${grabacion.archivo} se está procesando en modo demostración.`
    );

    this.cerrarCarga();

    window.setTimeout(() => {
      this.datos.actualizarEstadoGrabacion(
        grabacion.id,
        'completado'
      );

      this.mensaje.set(
        `${grabacion.archivo} terminó su procesamiento simulado.`
      );
    }, 1800);
  }
}