import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { ApiService, MarkedPerson } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { FaceAppearance } from '../../core/models/face.model';

interface Person {
  faceId: string;
  appearance: FaceAppearance;
}

@Component({
  selector: 'app-marked',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageFallbackDirective],
  templateUrl: './marked.html',
  styleUrl: './marked.css',
})
export class Marked implements OnInit {
  marked = signal<MarkedPerson[]>([]);

  people = signal<Person[]>([]);

  markedFaceIds = computed(
    () => new Set(this.marked().map(item => item.faceId))
  );

  showModal = signal(false);

  selectedPerson = signal<Person | null>(null);

  reason = signal('');

  message = signal('');

  messageIsError = signal(false);

  pendingDeleteId = signal<string | null>(null);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadMarked();

    this.api.getFaceAppearances().subscribe({
      next: data => {
        const map = new Map<string, FaceAppearance>();

        for (const appearance of data) {
          if (!map.has(appearance.faceId)) {
            map.set(appearance.faceId, appearance);
          }
        }

        this.people.set(
          Array.from(map.entries()).map(([faceId, appearance]) => ({
            faceId,
            appearance
          }))
        );
      },
      error: error => {
        this.showMessage(
          apiErrorMessage(error, 'No se pudieron cargar las detecciones.'),
          true
        );
      }
    });
  }

  private loadMarked(): void {
    this.api.getMarked().subscribe({
      next: data => this.marked.set(data),
      error: error => {
        this.showMessage(
          apiErrorMessage(error, 'No se pudieron cargar las marcas.'),
          true
        );
      }
    });
  }

  private showMessage(text: string, isError: boolean): void {
    this.message.set(text);
    this.messageIsError.set(isError);
  }

  isMarked(faceId: string): boolean {
    return this.markedFaceIds().has(faceId);
  }

  openModal(): void {
    this.reason.set('');
    this.selectedPerson.set(null);
    this.showMessage('', false);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedPerson.set(null);
    this.reason.set('');
  }

  selectPerson(person: Person): void {
    if (this.isMarked(person.faceId)) {
      return;
    }

    this.selectedPerson.set(person);
  }

  createMarked(): void {
    const person = this.selectedPerson();

    if (!person) {
      this.showMessage('Selecciona una persona.', true);
      return;
    }

    if (this.isMarked(person.faceId)) {
      this.showMessage('La detección ya está marcada.', true);
      return;
    }

    if (!this.reason().trim()) {
      this.showMessage('Ingresa una razón.', true);
      return;
    }

    this.api.createMarked({
      faceId: person.faceId,
      reason: this.reason().trim()
    }).subscribe({
      next: created => {
        this.marked.update(current => [...current, created]);
        this.closeModal();
        this.showMessage('Persona guardada.', false);
      },
      error: error => {
        this.loadMarked();
        this.showMessage(
          apiErrorMessage(error, 'No se pudo guardar la persona.'),
          true
        );
      }
    });
  }

  getPersonImage(faceId: string): string | undefined {
    return this.people().find(
      person => person.faceId === faceId
    )?.appearance.frameUrl;
  }

  askDelete(item: MarkedPerson): void {
    this.pendingDeleteId.set(item.id ?? null);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  confirmDelete(item: MarkedPerson): void {
    if (!item.id) {
      return;
    }

    const id = item.id;

    this.api.deleteMarked(id).subscribe({
      next: () => {
        this.marked.update(list => list.filter(current => current.id !== id));
        this.pendingDeleteId.set(null);
        this.showMessage('Marca eliminada.', false);
      },
      error: error => {
        this.pendingDeleteId.set(null);
        this.showMessage(
          apiErrorMessage(error, 'No se pudo eliminar la marca.'),
          true
        );
      }
    });
  }
}
