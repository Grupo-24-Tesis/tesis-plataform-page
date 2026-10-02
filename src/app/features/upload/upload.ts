import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ApiService,
  Camera
} from '../../core/services/api.service';
import { PresignedUploadResponse, VideoUploadedRequest, VideoJobResponse } from '../../core/models/uploadVideo';
@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './upload.html',
  styleUrl: './upload.css'
})
export class Upload implements OnInit {
  cameras: Camera[] = [];
  selectedCameraId = '';

  selectedFile: File | null = null;

  loadingCameras = false;
  uploading = false;
  uploadProgress = 0;

  error = '';
  success = '';

  createdJob: VideoJobResponse | null = null;

  constructor(
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.loadCameras();
  }

  private loadCameras(): void {
    this.loadingCameras = true;
    this.error = '';

    this.api.getCameras().subscribe({
      next: (cameras) => {
        this.cameras = cameras;
        this.loadingCameras = false;
      },
      error: (error) => {
        console.error('Error cargando cámaras', error);

        this.error =
          'No se pudieron cargar las cámaras. Verifica que el backend esté disponible.';

        this.loadingCameras = false;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.error = '';
    this.success = '';
    this.createdJob = null;
    this.uploadProgress = 0;

    if (!input.files || input.files.length === 0) {
      this.selectedFile = null;
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith('video/')) {
      this.selectedFile = null;
      input.value = '';
      this.error = 'Selecciona un archivo de video válido.';
      return;
    }

    this.selectedFile = file;
  }

  uploadVideo(): void {
    this.error = '';
    this.success = '';
    this.createdJob = null;
    this.uploadProgress = 0;

    if (!this.selectedCameraId) {
      this.error = 'Selecciona una cámara.';
      return;
    }

    if (!this.selectedFile) {
      this.error = 'Selecciona un video primero.';
      return;
    }

    this.uploading = true;

    const file = this.selectedFile;

    this.api.requestVideoUploadUrl({
      fileName: file.name,
      contentType: file.type
    }).subscribe({
      next: (uploadData) => {
        this.uploadFileToS3(uploadData);
      },
      error: (error) => {
        console.error('Error solicitando URL de S3', error);

        this.error =
          'No se pudo preparar la carga del video en AWS S3.';

        this.uploading = false;
      }
    });
  }

  private uploadFileToS3(
    uploadData: PresignedUploadResponse
  ): void {
    if (!this.selectedFile) {
      this.error = 'No hay un archivo seleccionado.';
      this.uploading = false;
      return;
    }

    this.api.uploadVideoToS3(
      uploadData.uploadUrl,
      this.selectedFile
    ).subscribe({
      next: (event) => {
        if (
          event.type === HttpEventType.UploadProgress &&
          event.total
        ) {
          this.uploadProgress = Math.round(
            (event.loaded / event.total) * 100
          );
        }

        if (event.type === HttpEventType.Response) {
          this.uploadProgress = 100;
          this.notifyBackend(uploadData);
        }
      },
      error: (error) => {
        console.error('Error subiendo video a S3', error);

        this.error =
          'No se pudo subir el video a AWS S3. Verifica la configuración CORS del bucket.';

        this.uploading = false;
      }
    });
  }

  private notifyBackend(
    uploadData: PresignedUploadResponse
  ): void {
    this.api.notifyVideoUploaded({
      originalFileName: uploadData.originalFileName,
      bucket: uploadData.bucket,
      objectKey: uploadData.objectKey,
      cameraId: this.selectedCameraId
    }).subscribe({
      next: (job) => {
        this.createdJob = job;

        this.success =
          'El video se subió correctamente y fue registrado en el backend.';

        this.uploading = false;
      },
      error: (error) => {
        console.error('Error notificando al backend', error);

        this.error =
          'El video se subió a S3, pero no se pudo notificar al backend.';

        this.uploading = false;
      }
    });
  }
}