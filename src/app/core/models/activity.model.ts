export interface ActivityHour {
  hour: number;
  count: number;
}

export interface ActivityCamera {
  cameraId: string;
  cameraName: string;
  count: number;
}

export interface ActivityVideo {
  jobId: string;
  fileName: string;
  uploadedAt: string | null;
  count: number;
}

export interface ActivityFollowUp {
  investigation: number;
  resolved: number;
  markedOnly: number;
  none: number;
}

export interface ActivityResponse {
  hours: ActivityHour[];
  cameras: ActivityCamera[];
  videos: ActivityVideo[];
  followUp: ActivityFollowUp;
  total: number;
}
