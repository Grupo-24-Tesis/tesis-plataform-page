export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  bucket: string;
  objectKey: string;
  originalFileName: string;
  contentType: string;
  expiresAt: string;
}

export interface VideoUploadedRequest {
  originalFileName: string;
  bucket: string;
  objectKey: string;
  cameraId: string;
}

export interface VideoJobResponse {
  jobId: string;
  originalFileName: string;
  bucket: string;
  objectKey: string;
  cameraId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  failureReason?: string | null;
}