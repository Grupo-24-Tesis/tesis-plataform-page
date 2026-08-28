import { FaceAppearance } from './face.model';
export interface UniqueFace {
  faceId: string;
  appearances: FaceAppearance[];
  reportCount: number;
  suspect: boolean;
}