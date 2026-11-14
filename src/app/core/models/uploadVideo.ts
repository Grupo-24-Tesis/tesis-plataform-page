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
  startedAt?: string | null;
  completedAt?: string | null;
  faceCount?: number | null;
  queueWaitSeconds?: number | null;
  processingSeconds?: number | null;
}

export interface VideoJobMetrics {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  failureRate: number;
  averageQueueWaitSeconds: number | null;
  averageProcessingSeconds: number | null;
  totalFaces: number;
  averageFacesPerVideo: number | null;
}