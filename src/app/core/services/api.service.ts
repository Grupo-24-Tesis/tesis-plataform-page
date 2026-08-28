import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { ReportItem } from '../models/report.model';
import {FaceAppearance} from '../models/face.model';
import { UniqueFace } from '../models/UniqueFace';
export interface Guard { id?: string; name: string; shift: string; schedule: string; }
export interface Camera { id: string; name: string; active: boolean; }


export interface MarkedPerson { id?: string; faceId: string; reason: string; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:8080/api';
  constructor(private http: HttpClient) {}

  //Estas son las apis de guardias
  getGuards() { return this.http.get<Guard[]>(`${this.base}/guards`); }

  //Estas son las apis de camaras
  getCameras() { return this.http.get<Camera[]>(`${this.base}/cameras`); }


  // Estas son las apis de apariciones de caras
 getFaceAppearances() {
  return this.http.get<FaceAppearance[]>(
    `${this.base}/face-appearances`
  );
}

createFaceAppearance(payload: FaceAppearance) {
  return this.http.post<FaceAppearance>(
    `${this.base}/face-appearances`,
    payload
  );
}

getUniqueFaces() {
  return this.http.get<UniqueFace[]>(
    `${this.base}/face-appearances/unique`
  );
}

  // Estas son las apis de reportes
  getReports() { return this.http.get<ReportItem[]>(`${this.base}/reports`); }
  createReport(payload: ReportItem) { return this.http.post<ReportItem>(`${this.base}/reports`, payload); }

 updateReportStatus(
  id: string,
  status: ReportItem['status'],
  resolvedAt?: string,
  resolutionDescription?: string
) {
  return this.http.put<ReportItem>(
    `${this.base}/reports/${id}/status`,
    {
      status,
      resolvedAt,
      resolutionDescription
    }
  );
}

  // Estan son las apis de marked
  // Aunque tambien se usa la de aparaciones unicas para obtener las personas unicas xd
 getMarked() {
  return this.http.get<MarkedPerson[]>(`${this.base}/marked`);
}

createMarked(payload: MarkedPerson) {
  return this.http.post<MarkedPerson>(
    `${this.base}/marked`,
    payload
  );
}

deleteMarked(id: string) {
  return this.http.delete<void>(
    `${this.base}/marked/${id}`
  );
}

 
}