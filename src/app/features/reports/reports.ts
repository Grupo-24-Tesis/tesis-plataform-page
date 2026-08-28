import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService, FaceAppearance} from '../../core/services/api.service';
import { ReportItem } from '../../core/models/report.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {

  reports = signal<ReportItem[]>([]);
  appearances = signal<FaceAppearance[]>([]);

  showModal = false;

  newReport: Omit<ReportItem, 'id' | 'createdAt'> = {
    title: '',
    status: 'investigacion',
    priority: 'media',
    description: '',
    incidentDate: '',
    resolutionDescription: '',
    resolvedAt: '',
    faceIds: []
  };

  resolutionModal = false;

selectedReport: ReportItem | null = null;

resolutionData = {
  resolvedAt: '',
  resolutionDescription: ''
};

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadReports();
    this.loadAppearances();
  }

  loadReports(): void {
    this.api.getReports().subscribe({
      next: (data) => {
        console.log('REPORTS API =>', data);
        this.reports.set(data);
      },
      error: (err) => {
        console.error('Error loading reports', err);
      }
    });
  }

  openModal(): void {

    this.newReport = {
      title: '',
      status: 'investigacion',
      priority: 'media',
      description: '',
      incidentDate: '',
      resolutionDescription: '',
      resolvedAt: '',
      faceIds: []
    };

    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  createReport(): void {

    if (
      !this.newReport.title.trim() ||
      !this.newReport.description.trim() ||
      !this.newReport.incidentDate
    ) {
      return;
    }

    this.api.createReport(this.newReport as ReportItem).subscribe({
      next: (createdReport) => {

        console.log('REPORTE CREADO =>', createdReport);

        this.reports.update(reports => [
          ...reports,
          createdReport
        ]);

        this.closeModal();
      },

      error: (err) => {
        console.error('Error creating report', err);
      }
    });
  }

  updateStatus(
  report: ReportItem,
  event: Event
): void {

  const select = event.target as HTMLSelectElement;

  const newStatus = select.value as ReportItem['status'];

  // Si quiere solucionar el reporte,
  // primero mostramos el popup
  if (newStatus === 'solucionado') {

    this.selectedReport = report;

    this.resolutionData = {
      resolvedAt: '',
      resolutionDescription: ''
    };

    this.resolutionModal = true;

    // Volvemos visualmente al estado anterior
    select.value = report.status;

    return;
  }

  // Si vuelve a investigación,
  // hacemos el PUT directamente
  this.api.updateReportStatus(
    report.id,
    newStatus
  ).subscribe({
    next: (updatedReport) => {

      this.reports.update(reports =>
        reports.map(r =>
          r.id === updatedReport.id
            ? updatedReport
            : r
        )
      );

    },

    error: (err) => {
      console.error(
        'Error updating report status',
        err
      );

      select.value = report.status;
    }
  });
}

  loadAppearances(): void {
  this.api.getFaceAppearances().subscribe({
    next: (data) => {
      console.log('FACE APPEARANCES API =>', data);
      this.appearances.set(data);
    },
    error: (err) => {
      console.error('Error loading face appearances', err);
    }
  });
}

get uniquePeople(): {
  faceId: string;
  appearance: FaceAppearance;
}[] {

  const map = new Map<string, FaceAppearance>();

  for (const appearance of this.appearances()) {

    if (!map.has(appearance.faceId)) {
      map.set(appearance.faceId, appearance);
    }

  }

  return Array.from(map.entries()).map(
    ([faceId, appearance]) => ({
      faceId,
      appearance
    })
  );
}

toggleFace(faceId: string): void {

  if (this.newReport.faceIds.includes(faceId)) {

    this.newReport.faceIds =
      this.newReport.faceIds.filter(
        id => id !== faceId
      );

  } else {

    this.newReport.faceIds = [
      ...this.newReport.faceIds,
      faceId
    ];

  }
}

isFaceSelected(faceId: string): boolean {
  return this.newReport.faceIds.includes(faceId);
}

closeResolutionModal(): void {

  this.resolutionModal = false;

  this.selectedReport = null;

  this.resolutionData = {
    resolvedAt: '',
    resolutionDescription: ''
  };
}

confirmResolution(): void {

  if (!this.selectedReport) {
    return;
  }

  if (
    !this.resolutionData.resolvedAt ||
    !this.resolutionData.resolutionDescription.trim()
  ) {
    return;
  }

  this.api.updateReportStatus(
    this.selectedReport.id,
    'solucionado',
    this.resolutionData.resolvedAt,
    this.resolutionData.resolutionDescription
  ).subscribe({

    next: (updatedReport) => {

      this.reports.update(reports =>
        reports.map(r =>
          r.id === updatedReport.id
            ? updatedReport
            : r
        )
      );

      this.closeResolutionModal();
    },

    error: (err) => {
      console.error(
        'Error resolving report',
        err
      );
    }

  });
}
getPersonImage(faceId: string): string {
  const person = this.uniquePeople.find(
    p => p.faceId === faceId
  );

  return person?.appearance.frameUrl ?? '';
}
}