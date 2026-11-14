import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';

import { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { apiErrorMessage } from '../../core/services/api-error';
import { ReportItem } from '../../core/models/report.model';
import { SessionService } from '../../core/services/session.service';
import { FreshnessTimer, IMAGES_MAX_AGE_MS } from '../../shared/utils/freshness-timer';

import { FaceAppearance } from '../../core/models/face.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageFallbackDirective],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit, OnDestroy {



  reports = signal<ReportItem[]>([]);

  loading = signal(false);

  loadError = signal('');
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

  appearancesError = signal('');

  statusFilter: string = '';

dateType: string = 'incidente';

dateFilter: string = '';

selectedDate: string = '';

selectedMonth: string = '';

selectedYear: string = '';

startDate: string = '';

endDate: string = '';



  showModal = signal(false);

  formErrors = signal<string[]>([]);

  saving = signal(false);

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



  resolutionModal = signal(false);

  selectedReport = signal<ReportItem | null>(null);

  statusSaving = signal(false);

  statusError = signal('');

  resolutionErrors = signal<string[]>([]);

  resolutionData = {
    resolvedAt: '',
    resolutionDescription: ''
  };


  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private session: SessionService
  ) {}

  private appearancesToken = 0;

  private appearancesLoadedAt = 0;

  private appearancesRefreshing = false;

  private readonly freshness = new FreshnessTimer(() => this.refreshAppearancesIfStale());

  ngOnInit(): void {
    this.loadReports();
    this.loadAppearances();
    this.freshness.start();
    this.openForRequestedDetection();
  }

  ngOnDestroy(): void {
    this.freshness.stop();
    this.appearancesToken++;
  }

  openDetail(report: ReportItem): void {
    void this.router.navigate(['/reports', report.id]);
  }

  private refreshAppearancesIfStale(): void {
    const stale =
      !this.appearancesRefreshing &&
      Date.now() - this.appearancesLoadedAt >= IMAGES_MAX_AGE_MS;

    if (stale) {
      this.loadAppearances(true);
    }
  }


  private openForRequestedDetection(): void {

    const faceId = this.route.snapshot.queryParamMap.get('faceId');

    if (!faceId) {

      return;

    }

    this.openModal();

    this.newReport.faceIds = [faceId];

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { faceId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

  }


  loadReports(): void {
    this.fetchReports(this.api.getReports());
  }


  private fetchReports(request: Observable<ReportItem[]>): void {
    this.reports.set([]);
    this.loading.set(true);
    this.loadError.set('');

    request.subscribe({
      next: (data) => {
        this.reports.set(data);
        this.loading.set(false);
      },

      error: (err) => {
        this.loadError.set(
          apiErrorMessage(err, 'No se pudieron cargar los reportes.')
        );
        this.loading.set(false);
      }
    });
  }


  applyFilters(): void {

  let date: string | undefined;

  let startDate: string | undefined;

  let endDate: string | undefined;


  if (
    this.dateFilter === 'dia' &&
    this.selectedDate
  ) {

    date = this.selectedDate;

  }


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


  else if (
    this.dateFilter === 'ano' &&
    this.selectedYear
  ) {

    startDate =
      `${this.selectedYear}-01-01`;

    endDate =
      `${this.selectedYear}-12-31`;

  }


  else if (
    this.dateFilter === 'rango' &&
    (this.startDate || this.endDate)
  ) {

    startDate = this.startDate || undefined;

    endDate = this.endDate || undefined;

  }


  this.fetchReports(
    this.api.getFilteredReports(
      this.statusFilter || undefined,
      date,
      startDate,
      endDate,
      this.dateType
    )
  );

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

    this.formErrors.set([]);

    this.showModal.set(true);

  }


  @HostListener('document:keydown.escape')
  closeOpenModal(): void {
    if (this.resolutionModal()) {
      this.closeResolutionModal();
      return;
    }

    if (this.showModal()) {
      this.closeModal();
    }
  }

  closeModal(): void {

    this.showModal.set(false);

    this.formErrors.set([]);

  }



  private validateNewReport(): string[] {

    const errors: string[] = [];

    if (!this.newReport.title.trim()) {
      errors.push('Falta el título.');
    }

    if (!this.newReport.description.trim()) {
      errors.push('Falta la descripción.');
    }

    if (!this.newReport.incidentDate) {
      errors.push('Falta la fecha del incidente.');
    }

    if (this.newReport.status === 'solucionado') {

      if (!this.newReport.resolvedAt) {
        errors.push('Falta la fecha de resolución.');
      }

      if (!this.newReport.resolutionDescription?.trim()) {
        errors.push('Falta la descripción de la resolución.');
      }

    }

    return errors;

  }


  createReport(): void {

    if (this.saving()) {

      return;

    }


    const errors = this.validateNewReport();

    this.formErrors.set(errors);

    if (errors.length > 0) {

      return;

    }


    const isResolved = this.newReport.status === 'solucionado';

    const payload = {

      ...this.newReport,

      createdByGuardId: this.session.getActiveGuard()?.id,

      resolvedAt: isResolved ? this.newReport.resolvedAt : undefined,

      resolutionDescription: isResolved
        ? this.newReport.resolutionDescription
        : undefined

    } as ReportItem;


    this.saving.set(true);

    this.api.createReport(payload).subscribe({

      next: () => {

        this.saving.set(false);

        this.closeModal();

        this.applyFilters();

      },

      error: (err) => {

        this.saving.set(false);

        if (this.session.endIfGuardMissing(err)) {

          return;

        }

        this.formErrors.set([
          apiErrorMessage(err, 'No se pudo crear el reporte.')
        ]);

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


    if (this.statusSaving()) {

      select.value = report.status;

      return;

    }


    this.statusError.set('');


    if (newStatus === 'solucionado') {

      this.selectedReport.set(report);

      this.resolutionData = {

        resolvedAt: '',

        resolutionDescription: ''

      };

      this.resolutionErrors.set([]);

      this.resolutionModal.set(true);

     
      select.value = report.status;

      return;

    }



    this.statusSaving.set(true);

    this.api.updateReportStatus(

      report.id,

      newStatus

    ).subscribe({

      next: (updatedReport) => {

        this.statusSaving.set(false);

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

          'Error al actualizar el estado del reporte',

          err

        );

        this.statusSaving.set(false);

        this.statusError.set(
          apiErrorMessage(err, 'No se pudo actualizar el estado del reporte.')
        );

        select.value = report.status;

      }

    });

  }


  loadAppearances(keepCurrent = false): void {

    const token = ++this.appearancesToken;

    this.appearancesRefreshing = keepCurrent;

    this.api.getFaceAppearances().subscribe({

      next: (data) => {

        if (token !== this.appearancesToken) {

          return;

        }

        this.appearancesRefreshing = false;

        this.appearancesLoadedAt = Date.now();

        this.appearances.set(data);

        this.appearancesError.set('');

      },

      error: (err) => {

        if (token !== this.appearancesToken) {

          return;

        }

        this.appearancesRefreshing = false;

        if (keepCurrent) {

          return;

        }

        console.error(
          'Error al cargar las apariciones de rostros',
          err
        );

        this.appearancesError.set(
          apiErrorMessage(err, 'No se pudieron cargar las detecciones.')
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

    this.resolutionModal.set(false);

    this.selectedReport.set(null);

    this.resolutionErrors.set([]);

    this.resolutionData = {

      resolvedAt: '',

      resolutionDescription: ''

    };

  }


  
  confirmResolution(): void {

    const reportToResolve = this.selectedReport();

    if (!reportToResolve || this.statusSaving()) {

      return;

    }


    const errors: string[] = [];

    if (!this.resolutionData.resolvedAt) {
      errors.push('Falta la fecha de resolución.');
    }

    if (!this.resolutionData.resolutionDescription.trim()) {
      errors.push('Falta la descripción de la resolución.');
    }

    this.resolutionErrors.set(errors);

    if (errors.length > 0) {

      return;

    }


    this.statusSaving.set(true);

    this.api.updateReportStatus(

      reportToResolve.id,

      'solucionado',

      this.resolutionData.resolvedAt,

      this.resolutionData
        .resolutionDescription

    ).subscribe({

      next: (updatedReport) => {

        this.statusSaving.set(false);

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

          'Error al resolver el reporte',

          err

        );

        this.statusSaving.set(false);

        this.resolutionErrors.set([
          apiErrorMessage(err, 'No se pudo resolver el reporte.')
        ]);

      }

    });

  }

}