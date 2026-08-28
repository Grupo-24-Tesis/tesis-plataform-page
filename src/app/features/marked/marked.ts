import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  MarkedPerson,
  
} from '../../core/services/api.service';
import { FaceAppearance } from '../../core/models/face.model';
interface Person {
  faceId: string;
  appearance: FaceAppearance;
}

@Component({
  selector: 'app-marked',
  standalone: true,
 imports: [CommonModule, FormsModule],
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

    // Cargar personas marcadas
    this.api.getMarked().subscribe({
      next: (data) => {
        console.log('MARKED API =>', data);
        this.marked.set(data);
      },
      error: (err) => {
        console.error('Error loading marked people', err);
      }
    });

    // Cargar apariciones para obtener las personas únicas
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

    this.people.set(people);
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
  getPersonImage(faceId: string): string | undefined {
  return this.people().find(
    person => person.faceId === faceId
  )?.appearance.frameUrl;
}
deleteMarked(marked: MarkedPerson) {

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