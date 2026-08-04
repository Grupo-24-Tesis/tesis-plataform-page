export interface FaceAppearance {
  faceId: string;
  timestamp: string; // "00:01:23"
  cameraId: string;
  frameUrl?: string;
}

export interface PersonCluster {
  clusterId: string;
  appearances: FaceAppearance[];
}

export interface ProcessingResult {
  videoName: string;
  processedAt: string; // ISO
  clusters: PersonCluster[];
}