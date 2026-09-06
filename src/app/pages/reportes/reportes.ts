import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';

import {
  DatosDemo,
  EstadoReporte,
  PrioridadReporte
} from '../../core/services/datos-demo';

@Component({
  selector: 'app-reportes',
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css'
})
export class Reportes {
  readonly datos = inject(DatosDemo);

  readonly vigilante = input.required<string>();

  readonly filtro =
    signal<'todos' | EstadoReporte>('todos');

  readonly seleccionadoId = signal<string | null>(null);
  readonly error = signal('');
  readonly aviso = signal('');

  readonly dialogoNuevo =
    viewChild<ElementRef<HTMLDialogElement>>('dialogoNuevo');

  readonly dialogoEditarCamaras =
    viewChild<ElementRef<HTMLDialogElement>>(
      'dialogoEditarCamaras'
    );

  readonly dialogoEditarGrupos =
    viewChild<ElementRef<HTMLDialogElement>>(
      'dialogoEditarGrupos'
    );

  nuevoTitulo = '';
  nuevaDescripcion = '';
  nuevaPrioridad: PrioridadReporte = 'media';
  nuevasCamaras: string[] = [];

  camarasEdicion: string[] = [];
  gruposEdicion: string[] = [];

  readonly reportesFiltrados = computed(() => {
    const filtro = this.filtro();

    return filtro === 'todos'
      ? this.datos.reportes()
      : this.datos.reportes().filter(
          reporte => reporte.estado === filtro
        );
  });

  readonly seleccionado = computed(() => {
    const id = this.seleccionadoId();

    return id
      ? this.datos.reportePorId(id) ?? null
      : null;
  });

  readonly totalInvestigacion = computed(() =>
    this.datos.reportes().filter(
      reporte => reporte.estado === 'investigacion'
    ).length
  );

  readonly totalSolucionados = computed(() =>
    this.datos.reportes().filter(
      reporte => reporte.estado === 'solucionado'
    ).length
  );

  seleccionar(id: string): void {
    this.seleccionadoId.set(id);
  }

  abrirNuevoReporte(): void {
    this.nuevoTitulo = '';
    this.nuevaDescripcion = '';
    this.nuevaPrioridad = 'media';
    this.nuevasCamaras = [];
    this.error.set('');

    this.dialogoNuevo()?.nativeElement.showModal();
  }

  cerrarNuevoReporte(): void {
    this.dialogoNuevo()?.nativeElement.close();
    this.error.set('');
  }

  alternarCamara(id: string): void {
    this.nuevasCamaras = this.nuevasCamaras.includes(id)
      ? this.nuevasCamaras.filter(
          camara => camara !== id
        )
      : [...this.nuevasCamaras, id];
  }

  crearReporte(): void {
    const titulo = this.nuevoTitulo.trim();
    const descripcion = this.nuevaDescripcion.trim();

    if (titulo.length < 5) {
      this.error.set(
        'El título debe tener al menos cinco caracteres.'
      );
      return;
    }

    if (descripcion.length < 10) {
      this.error.set(
        'La descripción debe tener al menos diez caracteres.'
      );
      return;
    }

    if (this.nuevasCamaras.length === 0) {
      this.error.set(
        'Selecciona al menos una cámara.'
      );
      return;
    }

    const reporte = this.datos.crearReporte({
      titulo,
      descripcion,
      prioridad: this.nuevaPrioridad,
      creadoPor: this.vigilante(),
      camaras: this.nuevasCamaras,
      gruposVinculados: []
    });

    this.filtro.set('todos');
    this.seleccionadoId.set(reporte.id);
    this.aviso.set(
      `${reporte.id} creado correctamente.`
    );

    this.cerrarNuevoReporte();
  }

  abrirEdicionCamaras(): void {
    const reporte = this.seleccionado();

    if (!reporte) {
      return;
    }

    this.camarasEdicion = [...reporte.camaras];
    this.error.set('');

    this.dialogoEditarCamaras()
      ?.nativeElement
      .showModal();
  }

  cerrarEdicionCamaras(): void {
    this.dialogoEditarCamaras()
      ?.nativeElement
      .close();

    this.error.set('');
  }

  alternarCamaraEdicion(id: string): void {
    this.camarasEdicion =
      this.camarasEdicion.includes(id)
        ? this.camarasEdicion.filter(
            camara => camara !== id
          )
        : [...this.camarasEdicion, id];
  }

  guardarCamarasReporte(): void {
    const reporte = this.seleccionado();

    if (!reporte) {
      return;
    }

    if (this.camarasEdicion.length === 0) {
      this.error.set(
        'Selecciona al menos una cámara.'
      );
      return;
    }

    this.datos.actualizarCamarasReporte(
      reporte.id,
      this.camarasEdicion
    );

    this.aviso.set(
      `Cámaras de ${reporte.id} actualizadas correctamente.`
    );

    this.cerrarEdicionCamaras();
  }

  abrirEdicionGrupos(): void {
    const reporte = this.seleccionado();

    if (!reporte) {
      return;
    }

    this.gruposEdicion = [
      ...reporte.gruposVinculados
    ];

    this.error.set('');

    this.dialogoEditarGrupos()
      ?.nativeElement
      .showModal();
  }

  cerrarEdicionGrupos(): void {
    this.dialogoEditarGrupos()
      ?.nativeElement
      .close();

    this.error.set('');
  }

  alternarGrupoEdicion(id: string): void {
    this.gruposEdicion =
      this.gruposEdicion.includes(id)
        ? this.gruposEdicion.filter(
            grupo => grupo !== id
          )
        : [...this.gruposEdicion, id];
  }

  guardarGruposReporte(): void {
    const reporte = this.seleccionado();

    if (!reporte) {
      return;
    }

    this.datos.actualizarGruposReporte(
      reporte.id,
      this.gruposEdicion
    );

    this.aviso.set(
      `Personas vinculadas a ${reporte.id} actualizadas. Las nuevas selecciones fueron añadidas a Guardados.`
    );

    this.cerrarEdicionGrupos();
  }

  marcarSolucionado(): void {
    const reporte = this.seleccionado();

    if (!reporte) {
      return;
    }

    this.datos.cambiarEstadoReporte(
      reporte.id,
      'solucionado'
    );

    this.aviso.set(
      `${reporte.id} marcado como solucionado.`
    );
  }

  reabrirReporte(): void {
    const reporte = this.seleccionado();

    if (!reporte) {
      return;
    }

    this.datos.cambiarEstadoReporte(
      reporte.id,
      'investigacion'
    );

    this.aviso.set(
      `${reporte.id} regresó a investigación.`
    );
  }
}