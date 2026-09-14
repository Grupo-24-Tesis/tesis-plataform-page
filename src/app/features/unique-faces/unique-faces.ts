import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService, Camera } from '../../core/services/api.service';
import { UniqueFace } from '../../core/models/UniqueFace';

@Component({
  selector: 'app-unique-faces',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './unique-faces.html',
  styleUrl: './unique-faces.css',
})
export class UniqueFaces implements OnInit {

  // ==========================================
  // DATOS
  // ==========================================

  faces = signal<UniqueFace[]>([]);
  cameras = signal<Camera[]>([]);

  selected = signal<UniqueFace | null>(null);


  // ==========================================
  // FILTROS
  // ==========================================

  startDate: string = '';

  endDate: string = '';

  hasReports: string = '';

  suspect: string = '';


  constructor(private api: ApiService) {}


  // ==========================================
  // INICIO
  // ==========================================

  ngOnInit(): void {

    this.loadFaces();
        this.api.getCameras().subscribe({
      next: (cameras) => this.cameras.set(cameras),
      error: (err) => console.error('Error loading cameras', err)
    });

  }
  getCameraName(cameraId: string): string {
    return this.cameras().find(camera => camera.id === cameraId)?.name
      ?? 'Cámara no identificada';
  }


  // ==========================================
  // CARGAR CARAS
  // ==========================================

  loadFaces(): void {

    const reportsFilter =
      this.hasReports === ''
        ? undefined
        : this.hasReports === 'true';


    const suspectFilter =
      this.suspect === ''
        ? undefined
        : this.suspect === 'true';


    this.api.getUniqueFaces(
      this.startDate || undefined,
      this.endDate || undefined,
      reportsFilter,
      suspectFilter
    ).subscribe({

      next: (data) => {

        console.log(
          'UNIQUE FACES API =>',
          data
        );

        this.faces.set(data);

      },

      error: (err) => {

        console.error(
          'Error loading unique faces',
          err
        );

      }

    });

  }


  // ==========================================
  // APLICAR FILTROS
  // ==========================================

  applyFilters(): void {

    this.selected.set(null);

    this.loadFaces();

  }


  // ==========================================
  // LIMPIAR FILTROS
  // ==========================================

  clearFilters(): void {

    this.startDate = '';

    this.endDate = '';

    this.hasReports = '';

    this.suspect = '';

    this.selected.set(null);

    this.loadFaces();

  }


  // ==========================================
  // SELECCIONAR CARA
  // ==========================================

  selectFace(face: UniqueFace): void {

    if (
      this.selected()?.faceId === face.faceId
    ) {

      this.selected.set(null);

    } else {

      this.selected.set(face);

    }

  }

}