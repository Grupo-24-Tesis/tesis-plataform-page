import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { ReportItem } from '../models/report.model';
import {FaceAppearance} from '../models/face.model';
import { UniqueFace } from '../models/UniqueFace';
import { PresignedUploadRequest, PresignedUploadResponse, VideoJobResponse, VideoUploadedRequest } from '../models/uploadVideo';
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

getUniqueFaces(
  startDate?: string,
  endDate?: string,
  hasReports?: boolean,
  suspect?: boolean
) {

  let params: any = {};

  if (startDate) {
    params.startDate = startDate;
  }

  if (endDate) {
    params.endDate = endDate;
  }

  if (hasReports !== undefined) {
    params.hasReports = hasReports;
  }

  if (suspect !== undefined) {
    params.suspect = suspect;
  }

  return this.http.get<UniqueFace[]>(
    `${this.base}/face-appearances/unique`,
    { params }
  );
}

  // Estas son las apis de reportes
  getReports() { return this.http.get<ReportItem[]>(`${this.base}/reports`); }
  getFilteredReports(
  status?: string,
  date?: string,
  startDate?: string,
  endDate?: string,
  dateType?: string
) {
  let params: any = {};

  if (status) {
    params.status = status;
  }

  if (date) {
    params.date = date;
  }

  if (startDate) {
    params.startDate = startDate;
  }

  if (endDate) {
    params.endDate = endDate;
  }

  if (dateType) {
    params.dateType = dateType;
  }

  return this.http.get<ReportItem[]>(
    `${this.base}/reports/filter`,
    { params }
  );
}
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

//api para el cargue del video
requestVideoUploadUrl(
  payload: PresignedUploadRequest
) {
  return this.http.post<PresignedUploadResponse>(
    `${this.base}/videos/upload-url`,
    payload
  );
}

uploadVideoToS3(
  uploadUrl: string,
  file: File
) {
  return this.http.put(
    uploadUrl,
    file,
    {
      headers: {
        'Content-Type': file.type
      },
      observe: 'events',
      reportProgress: true,
      responseType: 'text'
    }
  );
}

notifyVideoUploaded(
  payload: VideoUploadedRequest
) {
  return this.http.post<VideoJobResponse>(
    `${this.base}/videos`,
    payload
  );
}
 
}