import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Guard { id?: string; name: string; shift: string; schedule: string; }
export interface Camera { id: string; name: string; active: boolean; }
export interface FaceAppearance { id?: string; faceId: string; timestamp: string; cameraId: string; frameUrl?: string; }
export interface ReportItem { id: string; title: string; status: string; priority: string; description: string; }
export interface MarkedPerson { id?: string; faceId: string; reason: string; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:8080/api';
  constructor(private http: HttpClient) {}

  getGuards() { return this.http.get<Guard[]>(`${this.base}/guards`); }

  getCameras() { return this.http.get<Camera[]>(`${this.base}/cameras`); }

  getFaceAppearances() { return this.http.get<FaceAppearance[]>(`${this.base}/face-appearances`); }
  createFaceAppearance(payload: FaceAppearance) {
    return this.http.post<FaceAppearance>(`${this.base}/face-appearances`, payload);
  }

  getReports() { return this.http.get<ReportItem[]>(`${this.base}/reports`); }
  createReport(payload: ReportItem) { return this.http.post<ReportItem>(`${this.base}/reports`, payload); }

  getMarked() { return this.http.get<MarkedPerson[]>(`${this.base}/marked`); }
  createMarked(payload: MarkedPerson) { return this.http.post<MarkedPerson>(`${this.base}/marked`, payload); }

  updateReportStatus(id: string, status: ReportItem['status']) {
  return this.http.put<ReportItem>(
    `${this.base}/reports/${id}/status`,
    { status }
  );
}
}