import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { UniqueFace } from '../../core/models/UniqueFace';

@Component({
  selector: 'app-unique-faces',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unique-faces.html',
  styleUrl: './unique-faces.css',
})
export class UniqueFaces implements OnInit {

  faces = signal<UniqueFace[]>([]);

  selected = signal<UniqueFace | null>(null);

  constructor(private api: ApiService) {}

  ngOnInit(): void {

    this.api.getUniqueFaces().subscribe({

      next: (data) => {

        console.log('UNIQUE FACES API =>', data);

        this.faces.set(data);

      },

      error: (err) => {

        console.error(
          'Error loading unique faces',
          err
        );

      }

    });
  }

  selectFace(face: UniqueFace): void {

    if (this.selected()?.faceId === face.faceId) {

      this.selected.set(null);

    } else {

      this.selected.set(face);

    }

  }
}