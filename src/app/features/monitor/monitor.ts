import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';

@Component({
  selector: 'app-monitor',
  imports: [[CommonModule]],
  templateUrl: './monitor.html',
  styleUrl: './monitor.css',
})
export class MonitorComponent {
  constructor(public data: MockDataService) {}
}