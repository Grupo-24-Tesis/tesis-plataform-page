import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';

@Component({
  selector: 'app-reports',
  imports: [[CommonModule]],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {
  constructor(public data: MockDataService) {}
}