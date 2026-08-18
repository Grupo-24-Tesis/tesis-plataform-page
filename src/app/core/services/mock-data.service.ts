import { Injectable } from '@angular/core';
import { Guard } from '../models/guard.model';
import { Camera } from '../models/camera.model';
import { FaceAppearance } from '../models/face.model';
import { ReportItem } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  guards: Guard[] = [
    { id: 'g1', name: 'Carlos Ramírez', shift: 'mañana', schedule: '06:00-14:00' },
    { id: 'g2', name: 'Andrés Torres', shift: 'tarde', schedule: '14:00-22:00' },
    { id: 'g3', name: 'Patricia Méndez', shift: 'noche', schedule: '22:00-06:00' },
  ];

  cameras: Camera[] = [
    { id: 'CAM-01', name: 'Entrada Principal', active: true },
    { id: 'CAM-02', name: 'Parqueadero A', active: true },
    { id: 'CAM-03', name: 'Zona Común Piscina', active: true },
  ];

  appearances: FaceAppearance[] = [
    { faceId: 'person_001', timestamp: '08:14:32', cameraId: 'CAM-01' },
    { faceId: 'person_001', timestamp: '08:22:07', cameraId: 'CAM-03' },
    { faceId: 'person_002', timestamp: '09:10:01', cameraId: 'CAM-01' },
    { faceId: 'person_002', timestamp: '09:14:28', cameraId: 'CAM-02' },
    { faceId: 'person_003', timestamp: '10:04:11', cameraId: 'CAM-03' },
  ];

  reports: ReportItem[] = [
    { id: 'REP-001', title: 'Ingreso sospechoso', status: 'investigacion', priority: 'alta', description: 'Persona no identificada en cuarto de bombas.' },
    { id: 'REP-002', title: 'Vehículo abandonado', status: 'investigacion', priority: 'media', description: 'Más de 72 horas sin autorización.' },
    { id: 'REP-003', title: 'Riña en zona común', status: 'solucionado', priority: 'media', description: 'Caso cerrado con administración.' },
  ];
}