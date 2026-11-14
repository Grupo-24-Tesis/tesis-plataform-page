export interface ActivityHour {
  hour: number;
  count: number;
}

export interface ActivityCamera {
  cameraId: string;
  cameraName: string;
  count: number;
}

export interface ActivityResponse {
  hours: ActivityHour[];
  cameras: ActivityCamera[];
  total: number;
}
