import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessingResult } from '../../shared/models/processing.models';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './results.html',
  styleUrl: './results.css'
})
export class Results implements OnInit {
  result: ProcessingResult | null = null;
  message = '';

  ngOnInit(): void {
    const raw = localStorage.getItem('lastMockResult');
    if (raw) this.result = JSON.parse(raw);
  }

  // Simula guardado exitoso (sin backend)
  saveMock(): void {
    if (!this.result) return;
    this.message = 'Resultado guardado (simulado)';
  }
}