export type MatchDecision = 'confirmada' | 'descartada';

export interface MatchDetection {
  faceId: string;
  jobId: string;
  cameraId: string;
  cameraName: string;
  videoName: string;
  timestamp: string;
  capturedAt?: string;
  score: number | null;
  frameUrl?: string;
}

export interface MatchLink {
  id: string;
  faceIdA: string;
  faceIdB: string;
  createdByGuardId?: string;
  createdAt?: string;
}

export interface DiscardedMatch {
  id: string;
  detection: MatchDetection;
}

export interface DetectionMatches {
  faceId: string;
  links: MatchLink[];
  detections: MatchDetection[];
  discarded?: DiscardedMatch[];
}

export interface MatchDecisionRequest {
  faceIdA: string;
  faceIdB: string;
  decision: MatchDecision;
  score: number | null;
  createdByGuardId?: string;
}
