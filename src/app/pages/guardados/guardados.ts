import {Component, ElementRef, computed, inject, signal, viewChild} from '@angular/core';

import { DatosDemo } from '../../core/services/datos-demo';

@Component({
  selector: 'app-guardados',
  imports: [],
  templateUrl: './guardados.html',
  styleUrl: './guardados.css'
})
export class Guardados {
  readonly datos = inject(DatosDemo);

  readonly seleccionadoId = signal<string | null>(null);
  readonly pendienteEliminar = signal<string | null>(null);
  readonly aviso = signal('');

  readonly dialogoEliminar =
    viewChild<ElementRef<HTMLDialogElement>>('dialogoEliminar');

  readonly dialogoVincular =
    viewChild<ElementRef<HTMLDialogElement>>('dialogoVincular');

  readonly seleccionado = computed(() =>
    this.datos.gruposGuardados().find(
      grupo => grupo.id === this.seleccionadoId()
    ) ?? null
  );

  readonly cantidadMarcados = computed(() =>
    this.datos.gruposGuardados().filter(
      grupo => this.datos.estaMarcado(grupo.id)
    ).length
  );

  readonly reportesVinculados = computed(() => {
    const grupo = this.seleccionado();

    return grupo
      ? this.datos.reportesVinculadosAlGrupo(grupo.id)
      : [];
  });

  readonly reportesDisponibles = computed(() => {
    const grupo = this.seleccionado();

    return grupo
      ? this.datos.reportesDisponiblesParaGrupo(grupo.id)
      : [];
  });

  seleccionar(id: string): void {
    this.seleccionadoId.set(id);
    this.aviso.set('');
  }

  abrirVinculacion(): void {
    if (!this.seleccionado()) {
      return;
    }

    this.dialogoVincular()?.nativeElement.showModal();
  }

  cerrarVinculacion(): void {
    this.dialogoVincular()?.nativeElement.close();
  }

  vincular(reporteId: string): void {
    const grupo = this.seleccionado();

    if (!grupo) {
      return;
    }

    this.datos.vincularGrupoAReporte(
      grupo.id,
      reporteId
    );

    this.aviso.set(
      `${grupo.nombre} vinculado con ${reporteId}.`
    );

    this.cerrarVinculacion();
  }

  desvincular(reporteId: string): void {
    const grupo = this.seleccionado();

    if (!grupo) {
      return;
    }

    this.datos.desvincularGrupoDeReporte(
      grupo.id,
      reporteId
    );

    this.aviso.set(
      `${grupo.nombre} desvinculado de ${reporteId}.`
    );
  }

  solicitarEliminar(id: string): void {
    this.pendienteEliminar.set(id);
    this.dialogoEliminar()?.nativeElement.showModal();
  }

  cancelarEliminar(): void {
    this.dialogoEliminar()?.nativeElement.close();
    this.pendienteEliminar.set(null);
  }

  confirmarEliminar(): void {
    const id = this.pendienteEliminar();

    if (!id) {
      return;
    }

    this.datos.quitarGuardado(id);

    if (this.seleccionadoId() === id) {
      this.seleccionadoId.set(null);
    }

    this.aviso.set(
      'Registro eliminado de Guardados. Sigue disponible en el Monitor.'
    );

    this.cancelarEliminar();
  }
}