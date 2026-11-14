import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { ApiService, Guard, MarkedPerson } from '../../core/services/api.service';
import { MarksService } from '../../shared/services/marks.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { FaceAppearance } from '../../core/models/face.model';
import { FreshnessTimer, IMAGES_MAX_AGE_MS } from '../../shared/utils/freshness-timer';

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
export class Marked implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  private readonly marks = inject(MarksService);

  marked = this.marks.marks;

  people = signal<Person[]>([]);

  peopleError = signal('');

  showModal = signal(false);

  selectedPerson = signal<Person | null>(null);

  reason = signal('');

  message = signal('');

  messageIsError = signal(false);

  modalMessage = signal('');

  busy = signal(false);

  loading = this.marks.loading;

  loadError = this.marks.loadError;

  pendingDeleteId = signal<string | null>(null);

  guards = signal<Guard[]>([]);

  private peopleToken = 0;

  private peopleLoadedAt = 0;

  private peopleRefreshing = false;

  private readonly freshness = new FreshnessTimer(() => this.refreshPeopleIfStale());



  ngOnInit(): void {
    this.loadMarked();
    this.loadPeople(false);
    this.freshness.start();

    this.api.getGuards().subscribe({
      next: guards => this.guards.set(guards),
      error: () => this.guards.set([])
    });
  }

  ngOnDestroy(): void {
    this.freshness.stop();
    this.peopleToken++;
  }

  private refreshPeopleIfStale(): void {
    const stale =
      !this.peopleRefreshing &&
      Date.now() - this.peopleLoadedAt >= IMAGES_MAX_AGE_MS;

    if (stale) {
      this.loadPeople(true);
    }
  }

  private loadPeople(keepCurrent: boolean): void {
    const token = ++this.peopleToken;
    this.peopleRefreshing = keepCurrent;

    this.api.getFaceAppearances().subscribe({
      next: data => {
        if (token !== this.peopleToken) {
          return;
        }

        this.peopleRefreshing = false;
        this.peopleLoadedAt = Date.now();
        this.peopleError.set('');

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
        if (token !== this.peopleToken) {
          return;
        }

        this.peopleRefreshing = false;

        if (keepCurrent) {
          return;
        }

        const message = apiErrorMessage(error, 'No se pudieron cargar las detecciones.');
        this.peopleError.set(message);
        this.showMessage(message, true);
      }
    });
  }

  markedByLabel(guardId: string): string {
    const name = this.guards().find(guard => guard.id === guardId)?.name;

    return name ? `Marcado por ${name}` : 'Marcado por un vigilante sin registro';
  }

  loadMarked(): void {
    this.marks.load();
  }

  private showMessage(text: string, isError: boolean): void {
    this.message.set(text);
    this.messageIsError.set(isError);
  }

  isMarked(faceId: string): boolean {
    return this.marks.isMarked(faceId);
  }

  openModal(): void {
    this.reason.set('');
    this.selectedPerson.set(null);
    this.modalMessage.set('');
    this.showMessage('', false);
    this.showModal.set(true);
  }

  @HostListener('document:keydown.escape')
  closeModalOnEscape(): void {
    if (this.showModal()) {
      this.closeModal();
    }
  }

  closeModal(): void {
    if (this.busy()) {
      return;
    }

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
      this.modalMessage.set('Selecciona una detección.');
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

    this.marks.create(person.faceId, this.reason().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeModal();
        this.showMessage('Detección marcada.', false);
      },
      error: error => {
        this.busy.set(false);
        this.selectedPerson.set(null);
        this.loadMarked();
        this.modalMessage.set(
          apiErrorMessage(error, 'No se pudo marcar la detección.')
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

    this.marks.remove(id).subscribe({
      next: () => {
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
