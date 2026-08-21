import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, FaceAppearance } from '../../core/services/api.service';

@Component({
  selector: 'app-unique-faces',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unique-faces.html',
  styleUrl: './unique-faces.css',
})
export class UniqueFaces implements OnInit {
  appearances = signal<FaceAppearance[]>([]);

  selected = signal<{
    faceId: string;
    appearances: FaceAppearance[];
  } | null>(null);

  grouped = computed(() => {
    const map = new Map<string, FaceAppearance[]>();

    for (const a of this.appearances()) {
      if (!map.has(a.faceId)) {
        map.set(a.faceId, []);
      }

      map.get(a.faceId)!.push(a);
    }

    return Array.from(map.entries()).map(
      ([faceId, appearances]) => ({
        faceId,
        appearances
      })
    );
  });

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getFaceAppearances().subscribe({
      next: (data) => {
        console.log('FACE APPEARANCES API =>', data);
        this.appearances.set(data);
      },
      error: (err) => {
        console.error('Error loading face appearances', err);
      }
    });
  }

  selectFace(item: {
    faceId: string;
    appearances: FaceAppearance[];
  }) {
    this.selected.set(item);
  }
}