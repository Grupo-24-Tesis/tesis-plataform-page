export interface FaceAppearance {
  faceId: string;
  timestamp: string;
  cameraId: string;
  frameUrl?: string;
}

export interface PersonCluster {
  clusterId: string;
  appearances: FaceAppearance[];
}

export interface ProcessingResult {
  videoName: string;
  processedAt: string; 
  clusters: PersonCluster[];
}