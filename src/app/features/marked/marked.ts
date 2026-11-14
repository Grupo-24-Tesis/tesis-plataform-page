import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import {ApiService, MarkedPerson, } from '../../core/services/api.service';
import { FaceAppearance } from '../../core/models/face.model';
interface Person {
  faceId: string;
  appearance: FaceAppearance;
}

interface LocalMonitorVideo {
  id: string;
  cameraId: string;
  fileName: string;
  processedAt: string;
  clusters: {
    clusterId: string;
    appearances: FaceAppearance[];
  }[];
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

  showModal = signal(false);

  selectedPerson = signal<Person | null>(null);

  reason = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadLocalMarked();

    this.api.getMarked().subscribe({
      next: (data) => {
        console.log('MARKED API =>', data);
        this.marked.update(current => {
          const localMarked = current.filter(
            marked => marked.id?.startsWith('LOCAL:')
          );

          const apiIds = new Set(data.map(marked => marked.id));

          return [
            ...data,
            ...localMarked.filter(marked => !apiIds.has(marked.id))
          ];
        });
      },
      error: (err) => {
        console.error('Error loading marked people', err);
      }
    });

   this.api.getFaceAppearances().subscribe({
    next: (data) => {
    const map = new Map<string, FaceAppearance>();

    for (const appearance of data) {
      if (!map.has(appearance.faceId)) {
        map.set(appearance.faceId, appearance);
      }
    }

    const people = Array.from(map.entries()).map(
      ([faceId, appearance]) => ({
        faceId,
        appearance
      })
    );

    console.log('PEOPLE =>', people);

    this.people.update(current => {
      const merged = [...people];

      current.forEach(localPerson => {
        const exists = merged.some(
          person => person.faceId === localPerson.faceId
        );

        if (!exists) {
          merged.push(localPerson);
        }
      });

      return merged;
    });
  },
  error: (err) => {
    console.error('Error loading people', err);
  }
});}
  
  openModal() {
    this.reason = '';
    this.selectedPerson.set(null);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedPerson.set(null);
    this.reason = '';
  }

  selectPerson(person: Person) {
    this.selectedPerson.set(person);
  }

  createMarked() {

    const person = this.selectedPerson();

    if (!person) {
      alert('Seleccione una persona');
      return;
    }

    if (!this.reason.trim()) {
      alert('Ingrese una razón');
      return;
    }

    const newMarked: MarkedPerson = {
      faceId: person.faceId,
      reason: this.reason.trim()
    };

    this.api.createMarked(newMarked).subscribe({
      next: (created) => {

        console.log('MARKED CREATED =>', created);

        this.marked.update(current => [
          ...current,
          created
        ]);

        this.closeModal();
      },

      error: (err) => {
        console.error('Error creating marked person', err);
      }
    });
  }
  private loadLocalMarked(): void {
    try {
      const savedIdsContent = localStorage.getItem(
        'facecluster-saved-clusters-v1'
      );

      const videosContent = localStorage.getItem(
        'facecluster-monitor-videos-v1'
      );

      if (!savedIdsContent || !videosContent) {
        return;
      }

      const savedIds: string[] = JSON.parse(savedIdsContent);
      const videos: LocalMonitorVideo[] = JSON.parse(videosContent);

      if (!Array.isArray(savedIds) || !Array.isArray(videos)) {
        return;
      }

      const localMarked: MarkedPerson[] = [];
      const localPeople: Person[] = [];

      savedIds.forEach(savedId => {
        const separatorPosition = savedId.indexOf(':');

        if (separatorPosition === -1) {
          return;
        }

        const videoId = savedId.slice(0, separatorPosition);
        const clusterId = savedId.slice(separatorPosition + 1);

        const video = videos.find(item => item.id === videoId);
        const cluster = video?.clusters.find(
          item => item.clusterId === clusterId
        );

        if (!video || !cluster || cluster.appearances.length === 0) {
          return;
        }

        localMarked.push({
          id: `LOCAL:${savedId}`,
          faceId: cluster.clusterId,
          reason: `Detección guardada desde ${video.fileName}`
        });

        localPeople.push({
          faceId: cluster.clusterId,
          appearance: cluster.appearances[0]
        });
      });

      this.marked.set(localMarked);
      this.people.set(localPeople);
    } catch {
      console.warn(
        'No fue posible recuperar las detecciones guardadas localmente.'
      );
    }
  }

  getPersonImage(faceId: string): string | undefined {
  return this.people().find(
    person => person.faceId === faceId
  )?.appearance.frameUrl;
}
deleteMarked(marked: MarkedPerson) {
    if (marked.id?.startsWith('LOCAL:')) {
    const savedId = marked.id.replace('LOCAL:', '');

    try {
      const content = localStorage.getItem(
        'facecluster-saved-clusters-v1'
      );

      const savedIds: string[] = content
        ? JSON.parse(content)
        : [];

      localStorage.setItem(
        'facecluster-saved-clusters-v1',
        JSON.stringify(
          savedIds.filter(currentId => currentId !== savedId)
        )
      );

      this.marked.update(list =>
        list.filter(item => item.id !== marked.id)
      );
    } catch {
      console.warn(
        'No fue posible eliminar la detección guardada.'
      );
    }

    return;
  }

  if (!marked.id) {
    console.error('El marcado no tiene ID');
    return;
  }

  this.api.deleteMarked(marked.id).subscribe({
    next: () => {

      console.log('Marcado eliminado:', marked.id);

      this.marked.update(list =>
        list.filter(m => m.id !== marked.id)
      );

    },

    error: err => {
      console.error('Error eliminando marcado', err);
    }
  });
}
}