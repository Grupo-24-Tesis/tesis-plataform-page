import { Component, ElementRef, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, Guard } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
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
  loading = signal(true);
  loadErrorMsg = signal('');
  dialogErrorMsg = signal('');
  saving = signal(false);
  newGuardName = '';

  constructor(
    private api: ApiService,
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.api.getGuards().subscribe({
      next: (data) => {
        this.guards.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar los vigilantes', err);
        this.guards.set([]);
        this.loadErrorMsg.set('No se pudieron cargar los vigilantes.');
        this.loading.set(false);
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

    this.session.setActiveGuard({ id: guard.id, name: guard.name });

    this.router.navigateByUrl('/monitor');
  }

  openGuardDialog(): void {
    this.newGuardName = '';
    this.dialogErrorMsg.set('');
    this.guardDialog?.nativeElement.showModal();
  }

  closeGuardDialog(): void {
    this.guardDialog?.nativeElement.close();
    this.newGuardName = '';
    this.dialogErrorMsg.set('');
  }

  addGuard(): void {
    if (this.saving()) {
      return;
    }

    const name = this.newGuardName.trim().replace(/\s+/g, ' ');

    if (name.length < 3) {
      this.dialogErrorMsg.set('Escribe un nombre de al menos tres caracteres.');
      return;
    }

    const exists = this.guards().some(
      guard =>
        guard.name.toLocaleLowerCase('es') ===
        name.toLocaleLowerCase('es')
    );

    if (exists) {
      this.dialogErrorMsg.set('Este vigilante ya está registrado.');
      return;
    }

    const guard: Omit<Guard, 'id'> = {
      name,
      shift: 'Sin asignar',
      schedule: 'Horario no definido'
    };

    this.saving.set(true);

    this.api.createGuard(guard).subscribe({
      next: (createdGuard) => {
        this.saving.set(false);
        this.guards.update(currentGuards => [
          ...currentGuards,
          createdGuard
        ]);
        this.selectedGuard.set(createdGuard);
        this.closeGuardDialog();
      },
      error: (err) => {
        console.error('Error al registrar el vigilante', err);
        this.saving.set(false);
        this.dialogErrorMsg.set(
          apiErrorMessage(err, 'No se pudo registrar el vigilante.')
        );
      }
    });
  }
}
