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

  modalMessage = signal('');

  busy = signal(false);

  loading = signal(false);

  loadError = signal('');

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

  loadMarked(): void {
    this.loading.set(true);
    this.loadError.set('');

    this.api.getMarked().subscribe({
      next: data => {
        this.marked.set(data);
        this.loading.set(false);
      },
      error: error => {
        this.loadError.set(
          apiErrorMessage(error, 'No se pudieron cargar las marcas.')
        );
        this.loading.set(false);
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
    this.modalMessage.set('');
    this.showMessage('', false);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedPerson.set(null);
    this.reason.set('');
    this.modalMessage.set('');
  }

  selectPerson(person: Person): void {
    if (this.isMarked(person.faceId)) {
      return;
    }

    this.selectedPerson.set(person);
  }

  createMarked(): void {
    if (this.busy()) {
      return;
    }

    const person = this.selectedPerson();

    if (!person) {
      this.modalMessage.set('Selecciona una persona.');
      return;
    }

    if (this.isMarked(person.faceId)) {
      this.modalMessage.set('La detección ya está marcada.');
      return;
    }

    if (!this.reason().trim()) {
      this.modalMessage.set('Ingresa una razón.');
      return;
    }

    this.busy.set(true);
    this.modalMessage.set('');

    this.api.createMarked({
      faceId: person.faceId,
      reason: this.reason().trim()
    }).subscribe({
      next: created => {
        this.marked.update(current => [...current, created]);
        this.busy.set(false);
        this.closeModal();
        this.showMessage('Detección marcada.', false);
      },
      error: error => {
        this.busy.set(false);
        this.selectedPerson.set(null);
        this.loadMarked();
        this.modalMessage.set(
          apiErrorMessage(error, 'No se pudo guardar la persona.')
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
    if (!item.id || this.busy()) {
      return;
    }

    const id = item.id;
    this.busy.set(true);

    this.api.deleteMarked(id).subscribe({
      next: () => {
        this.marked.update(list => list.filter(current => current.id !== id));
        this.busy.set(false);
        this.pendingDeleteId.set(null);
        this.showMessage('Marca eliminada.', false);
      },
      error: error => {
        this.busy.set(false);
        this.pendingDeleteId.set(null);
        this.showMessage(
          apiErrorMessage(error, 'No se pudo eliminar la marca.'),
          true
        );
      }
    });
  }
}
