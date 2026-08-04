import { Injectable } from '@angular/core';
import { ProcessingResult } from '../../shared/models/processing.models';

@Injectable({ providedIn: 'root' })
export class MockModelService {
  processVideoMock(file: File): Promise<ProcessingResult> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          videoName: file.name,
          processedAt: new Date().toISOString(),
          clusters: [
            {
              clusterId: 'person_001',
              appearances: [
                { faceId: 'f1', timestamp: '00:00:05', cameraId: 'cam_1' },
                { faceId: 'f2', timestamp: '00:00:13', cameraId: 'cam_1' }
              ]
            },
            {
                clusterId: 'person_002',
                appearances: [
                  { faceId: 'f3', timestamp: '00:00:20', cameraId: 'cam_2' },
                  { faceId: 'f4', timestamp: '00:00:25', cameraId: 'cam_2' }
                ]
            }
          ]
        });
      }, 1200);
    });
  }
}