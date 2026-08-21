import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, MarkedPerson } from '../../core/services/api.service';

@Component({
  selector: 'app-marked',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marked.html',
  styleUrl: './marked.css',
})
export class Marked implements OnInit {
  marked = signal<MarkedPerson[]>([]);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getMarked().subscribe({
      next: (data) => {
        console.log('MARKED API =>', data);
        this.marked.set(data);
      },
      error: (err) => {
        console.error('Error loading marked people', err);
      }
    });
  }
}