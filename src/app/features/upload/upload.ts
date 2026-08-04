import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MockModelService } from '../../core/services/mock-model';
import { ProcessingResult } from '../../shared/models/processing.models';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.html',
  styleUrl: './upload.css'
})
export class Upload {
  selectedFile: File | null = null;
  loading = false;
  error = '';

  constructor(
    private mockModelService: MockModelService,
    private router: Router
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.error = '';

    if (!input.files || input.files.length === 0) {
      this.selectedFile = null;
      return;
    }

    this.selectedFile = input.files[0];
  }

  async processMock(): Promise<void> {
    if (!this.selectedFile) {
      this.error = 'Selecciona un video primero.';
      return;
    }

    try {
      this.loading = true;
      const result: ProcessingResult = await this.mockModelService.processVideoMock(this.selectedFile);

      // Se esta guardando temporalmente en localStorage para simular el guardado y poder mostrarlo en la página de resultados
      localStorage.setItem('lastMockResult', JSON.stringify(result));

      this.router.navigate(['/results']);
    } catch (e) {
      this.error = 'Ocurrió un error procesando el video mock.';
    } finally {
      this.loading = false;
    }
  }
}