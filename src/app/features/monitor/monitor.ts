import { Component, OnInit,signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Camera } from '../../core/services/api.service';

@Component({
  selector: 'app-monitor',
  imports: [[CommonModule]],
  templateUrl: './monitor.html',
  styleUrl: './monitor.css',
})
export class MonitorComponent implements OnInit {
  cameras = signal<Camera[]>([]);
  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getCameras().subscribe({
      next: (data) => {
        console.log('CAMERAS API =>', data);

        this.cameras.set(data);
        
      },
      error: err => console.error('Error loading cameras', err)
    });
  }
}