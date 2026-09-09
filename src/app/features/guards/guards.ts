import { Component, ElementRef, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, Guard } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-guards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guards.html',
  styleUrl: './guards.css',
})
export class Guards implements OnInit {
  @ViewChild('guardDialog') guardDialog?: ElementRef<HTMLDialogElement>;

  guards = signal<Guard[]>([]);
  selectedGuard = signal<Guard | null>(null);
  loading = true;
  errorMsg = '';
  newGuardName = '';

  private readonly storageKey = 'facecluster-vigilantes-v1';

  private readonly demoGuards: Guard[] = [
    {
      id: 'GUARD-001',
      name: 'Carlos Ramírez',
      shift: 'Diurno',
      schedule: '08:00 - 16:00'
    },
    {
      id: 'GUARD-002',
      name: 'Andrés Torres',
      shift: 'Diurno',
      schedule: '08:00 - 16:00'
    },
    {
      id: 'GUARD-003',
      name: 'Patricia Méndez',
      shift: 'Tarde',
      schedule: '16:00 - 00:00'
    },
    {
      id: 'GUARD-004',
      name: 'Luis García',
      shift: 'Nocturno',
      schedule: '00:00 - 08:00'
    }
  ];

  constructor(
    private api: ApiService,
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const localGuards = this.loadLocalGuards();

    if (localGuards.length > 0) {
      this.guards.set(localGuards);
    }

    this.api.getGuards().subscribe({
      next: (data) => {
        console.log('GUARDS API =>', data);

        if (data.length > 0) {
          this.guards.set(this.mergeGuards(data, localGuards));
          this.saveLocalGuards();
        } else if (localGuards.length === 0) {
          this.guards.set(this.demoGuards);
          this.saveLocalGuards();
        }

        this.loading = false;
      },
      error: (err) => {
        console.error(err);

        if (localGuards.length === 0) {
          this.guards.set(this.demoGuards);
          this.saveLocalGuards();
        }

        this.errorMsg =
          'Modo demostración activo. Los datos se guardarán localmente.';
        this.loading = false;
      }
    });
  }

  initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  selectGuard(guard: Guard): void {
    this.selectedGuard.set(guard);
  }

  startShift(): void {
    const guard = this.selectedGuard();

    if (!guard?.id) {
      return;
    }

    this.session.setActiveGuard(guard.id);
    localStorage.setItem(
      'facecluster-active-guard',
      JSON.stringify(guard)
    );

    this.router.navigateByUrl('/monitor');
  }

  openGuardDialog(): void {
    this.newGuardName = '';
    this.errorMsg = '';
    this.guardDialog?.nativeElement.showModal();
  }

  closeGuardDialog(): void {
    this.guardDialog?.nativeElement.close();
    this.newGuardName = '';
    this.errorMsg = '';
  }

  addGuard(): void {
    const name = this.newGuardName.trim().replace(/\s+/g, ' ');

    if (name.length < 3) {
      this.errorMsg = 'Escribe un nombre de al menos tres caracteres.';
      return;
    }

    const exists = this.guards().some(
      guard =>
        guard.name.toLocaleLowerCase('es') ===
        name.toLocaleLowerCase('es')
    );

    if (exists) {
      this.errorMsg = 'Este vigilante ya está registrado.';
      return;
    }

    const guard: Guard = {
      id: this.generateGuardId(),
      name,
      shift: 'Sin asignar',
      schedule: 'Horario no definido'
    };

    this.guards.update(currentGuards => [...currentGuards, guard]);
    this.selectedGuard.set(guard);
    this.saveLocalGuards();
    this.closeGuardDialog();
  }

  private loadLocalGuards(): Guard[] {
    try {
      const content = localStorage.getItem(this.storageKey);

      if (!content) {
        return [];
      }

      const savedGuards = JSON.parse(content);

      if (!Array.isArray(savedGuards)) {
        return [];
      }

      /*
       * También reconoce los vigilantes guardados por la versión
       * anterior, que usaba las propiedades "nombre" e identificadores
       * numéricos.
       */
      return savedGuards
        .map((guard: any) => ({
          id: String(guard.id),
          name: guard.name ?? guard.nombre,
          shift: guard.shift ?? 'Sin asignar',
          schedule: guard.schedule ?? 'Horario no definido'
        }))
        .filter((guard: Guard) => guard.id && guard.name);
    } catch {
      console.warn('No fue posible recuperar los vigilantes guardados.');
      return [];
    }
  }

  private saveLocalGuards(): void {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.guards())
      );
    } catch {
      console.warn('No fue posible guardar los vigilantes.');
    }
  }

  private mergeGuards(apiGuards: Guard[], localGuards: Guard[]): Guard[] {
    const merged = [...apiGuards];

    localGuards.forEach(localGuard => {
      const exists = merged.some(
        guard =>
          guard.id === localGuard.id ||
          guard.name.toLocaleLowerCase('es') ===
          localGuard.name.toLocaleLowerCase('es')
      );

      if (!exists) {
        merged.push(localGuard);
      }
    });

    return merged;
  }

  private generateGuardId(): string {
    const guardNumbers = this.guards()
      .map(guard => Number(String(guard.id ?? '').replace(/\D/g, '')))
      .filter(number => Number.isFinite(number));

    const nextNumber = Math.max(...guardNumbers, 0) + 1;

    return `GUARD-${String(nextNumber).padStart(3, '0')}`;
  }
}