import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, ReportItem } from '../../core/services/api.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  reports = signal<ReportItem[]>([]);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
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
}