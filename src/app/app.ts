import {
  PLATFORM_ID,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';

import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Monitor } from './pages/monitor/monitor';

interface Vigilante {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    Monitor
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly claveVigilantes =
    'facecluster-vigilantes-v1';

  private readonly esNavegador =
    isPlatformBrowser(
      inject(PLATFORM_ID)
    );

  readonly vigilantes = signal<Vigilante[]>([
    {
      id: 1,
      nombre: 'Carlos Ramírez'
    },
    {
      id: 2,
      nombre: 'Andrés Torres'
    },
    {
      id: 3,
      nombre: 'Patricia Méndez'
    },
    {
      id: 4,
      nombre: 'Luis García'
    }
  ]);

  readonly seleccionado =
    signal<Vigilante | null>(null);

  readonly turnoIniciado = signal(false);
  readonly error = signal('');

  readonly dialogoGuardia =
    viewChild<ElementRef<HTMLDialogElement>>(
      'dialogoGuardia'
    );

  nuevoNombre = '';

  constructor() {
    if (!this.esNavegador) {
      return;
    }

    /*
     * Primero recuperamos la lista guardada.
     */
    try {
      const contenido = localStorage.getItem(
        this.claveVigilantes
      );

      if (contenido) {
        const vigilantesGuardados =
          JSON.parse(contenido);

        if (Array.isArray(vigilantesGuardados)) {
          this.vigilantes.set(
            vigilantesGuardados
          );
        }
      }
    } catch {
      console.warn(
        'No fue posible recuperar los vigilantes guardados.'
      );
    }

    /*
     * Después observamos la lista y guardamos
     * automáticamente cada modificación.
     */
    effect(() => {
      try {
        localStorage.setItem(
          this.claveVigilantes,
          JSON.stringify(this.vigilantes())
        );
      } catch {
        console.warn(
          'No fue posible guardar los vigilantes.'
        );
      }
    });
  }

  abrirRegistro(): void {
    this.nuevoNombre = '';
    this.error.set('');

    this.dialogoGuardia()
      ?.nativeElement
      .showModal();
  }

  cancelarRegistro(): void {
    this.dialogoGuardia()
      ?.nativeElement
      .close();

    this.nuevoNombre = '';
    this.error.set('');
  }

  iniciales(nombre: string): string {
    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(parte => parte[0])
      .join('')
      .toUpperCase();
  }

  seleccionar(vigilante: Vigilante): void {
    this.seleccionado.set(vigilante);
  }

  agregarVigilante(): void {
    const nombre = this.nuevoNombre
      .trim()
      .replace(/\s+/g, ' ');

    if (!nombre) {
      this.error.set(
        'Escribe el nombre del vigilante.'
      );
      return;
    }

    const existe = this.vigilantes().some(
      vigilante =>
        vigilante.nombre.toLocaleLowerCase('es') ===
        nombre.toLocaleLowerCase('es')
    );

    if (existe) {
      this.error.set(
        'Este vigilante ya está registrado.'
      );
      return;
    }

    const vigilante: Vigilante = {
      id:
        Math.max(
          ...this.vigilantes().map(
            actual => actual.id
          ),
          0
        ) + 1,
      nombre
    };

    this.vigilantes.update(lista => [
      ...lista,
      vigilante
    ]);

    this.seleccionado.set(vigilante);
    this.cancelarRegistro();
  }

  iniciarTurno(): void {
    if (this.seleccionado()) {
      this.turnoIniciado.set(true);
    }
  }

  salir(): void {
    this.turnoIniciado.set(false);
    this.seleccionado.set(null);
    this.cancelarRegistro();
  }
}