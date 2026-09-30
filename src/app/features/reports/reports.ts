import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/services/api.service';
import { ReportItem } from '../../core/models/report.model';

import { FaceAppearance } from '../../core/models/face.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {



  reports = signal<ReportItem[]>([]);
  readonly reportSections: {
  status: ReportItem['status'];
  title: string;
}[] = [
  { status: 'investigacion', title: 'En investigación' },
  { status: 'solucionado', title: 'Solucionados' }
];

getReportsByStatus(status: ReportItem['status']): ReportItem[] {
  return this.reports().filter(report => report.status === status);
}

  appearances = signal<FaceAppearance[]>([]);

  statusFilter: string = '';

dateType: string = 'incidente';

dateFilter: string = '';

selectedDate: string = '';

selectedMonth: string = '';

selectedYear: string = '';

startDate: string = '';

endDate: string = '';



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

      data.forEach(r => {
        console.log(
          'Reporte:',
          r.id,
          'incidentDate:',
          r.incidentDate,
          'Date:',
          new Date(r.incidentDate)
        );
      });

      this.reports.set(data);
    },

    error: (err) => {
      console.error('Error loading reports', err);
    }
  });
}


  applyFilters(): void {

  let date: string | undefined;

  let startDate: string | undefined;

  let endDate: string | undefined;


  // =================================
  // DÍA ESPECÍFICO
  // =================================

  if (
    this.dateFilter === 'dia' &&
    this.selectedDate
  ) {

    date = this.selectedDate;

  }


  // =================================
  // MES
  // =================================

  else if (
    this.dateFilter === 'mes' &&
    this.selectedMonth
  ) {

    const [year, month] =
      this.selectedMonth.split('-').map(Number);

    const firstDay =
      new Date(year, month - 1, 1);

    const lastDay =
      new Date(year, month, 0);


    startDate =
      this.formatDate(firstDay);

    endDate =
      this.formatDate(lastDay);

  }


  // =================================
  // AÑO
  // =================================

  else if (
    this.dateFilter === 'ano' &&
    this.selectedYear
  ) {

    startDate =
      `${this.selectedYear}-01-01`;

    endDate =
      `${this.selectedYear}-12-31`;

  }


  // =================================
  // RANGO
  // =================================

  else if (
    this.dateFilter === 'rango' &&
    this.startDate &&
    this.endDate
  ) {

    startDate = this.startDate;

    endDate = this.endDate;

  }


  // =================================
  // CONSULTAR BACKEND
  // =================================

  this.api.getFilteredReports(
    this.statusFilter || undefined,
    date,
    startDate,
    endDate,
    this.dateType
  ).subscribe({

    next: (data) => {

      console.log(
        'REPORTS FILTERED =>',
        data
      );

      this.reports.set(data);

    },

    error: (err) => {

      console.error(
        'Error filtering reports',
        err
      );

    }

  });

}


  clearFilters(): void {

  this.statusFilter = '';

  this.dateType = 'incidente';

  this.dateFilter = '';

  this.selectedDate = '';

  this.selectedMonth = '';

  this.selectedYear = '';

  this.startDate = '';

  this.endDate = '';

  this.loadReports();

}



  private formatDate(date: Date): string {

    const year =
      date.getFullYear();

    const month =
      String(date.getMonth() + 1)
        .padStart(2, '0');

    const day =
      String(date.getDate())
        .padStart(2, '0');

    return `${year}-${month}-${day}`;

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


    this.api.createReport(
      this.newReport as ReportItem
    ).subscribe({

      next: (createdReport) => {

        console.log(
          'REPORTE CREADO =>',
          createdReport
        );

        this.reports.update(
          reports => [
            ...reports,
            createdReport
          ]
        );

        this.closeModal();

      },

      error: (err) => {

        console.error(
          'Error creating report',
          err
        );

      }

    });

  }


  
  updateStatus(
    report: ReportItem,
    event: Event
  ): void {

    const select =
      event.target as HTMLSelectElement;

    const newStatus =
      select.value as ReportItem['status'];


   

    if (newStatus === 'solucionado') {

      this.selectedReport = report;

      this.resolutionData = {

        resolvedAt: '',

        resolutionDescription: ''

      };

      this.resolutionModal = true;

     
      select.value = report.status;

      return;

    }



    this.api.updateReportStatus(

      report.id,

      newStatus

    ).subscribe({

      next: (updatedReport) => {

        this.reports.update(

          reports =>

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

        console.log(
          'FACE APPEARANCES API =>',
          data
        );

        this.appearances.set(data);

      },

      error: (err) => {

        console.error(
          'Error loading face appearances',
          err
        );

      }

    });

  }




  get uniquePeople(): {

    faceId: string;

    appearance: FaceAppearance;

  }[] {

    const map =
      new Map<string, FaceAppearance>();


    for (const appearance of this.appearances()) {

      if (!map.has(appearance.faceId)) {

        map.set(
          appearance.faceId,
          appearance
        );

      }

    }


    return Array
      .from(map.entries())
      .map(
        ([faceId, appearance]) => ({

          faceId,

          appearance

        })
      );

  }



  toggleFace(faceId: string): void {

    if (
      this.newReport.faceIds.includes(faceId)
    ) {

      this.newReport.faceIds =

        this.newReport.faceIds.filter(

          id => id !== faceId

        );

    }

    else {

      this.newReport.faceIds = [

        ...this.newReport.faceIds,

        faceId

      ];

    }

  }


  isFaceSelected(
    faceId: string
  ): boolean {

    return this.newReport.faceIds
      .includes(faceId);

  }


  getPersonImage(
    faceId: string
  ): string {

    const person =
      this.uniquePeople.find(
        p => p.faceId === faceId
      );

    return person?.appearance.frameUrl ?? '';

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

      !this.resolutionData
        .resolutionDescription
        .trim()

    ) {

      return;

    }


    this.api.updateReportStatus(

      this.selectedReport.id,

      'solucionado',

      this.resolutionData.resolvedAt,

      this.resolutionData
        .resolutionDescription

    ).subscribe({

      next: (updatedReport) => {

        this.reports.update(

          reports =>

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

}