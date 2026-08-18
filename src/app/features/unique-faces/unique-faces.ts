import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { FaceAppearance } from '../../core/models/face.model';
@Component({
  selector: 'app-unique-faces',
  imports: [[CommonModule]],
  templateUrl: './unique-faces.html',
  styleUrl: './unique-faces.css',
})
export class UniqueFaces {
  selected: { faceId: string; appearances: FaceAppearance[] } | null = null;

  constructor(public data: MockDataService) {}

  get grouped() {
    const map = new Map<string, FaceAppearance[]>();
    for (const a of this.data.appearances) {
      if (!map.has(a.faceId)) map.set(a.faceId, []);
      map.get(a.faceId)!.push(a);
    }
    return Array.from(map.entries()).map(([faceId, appearances]) => ({ faceId, appearances }));
  }
}
