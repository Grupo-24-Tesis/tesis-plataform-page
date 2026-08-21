import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ReportItem } from '../../core/services/api.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {

  reports = signal<ReportItem[]>([]);

  showModal = false;

  newReport: Omit<ReportItem, 'id'> = {
    title: '',
    status: 'investigacion',
    priority: 'media',
    description: ''
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadReports();
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
      description: ''
    };

    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  createReport(): void {

    if (
      !this.newReport.title.trim() ||
      !this.newReport.description.trim()
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
        console.error('Error updating report status', err);
      }
    });
  }
}