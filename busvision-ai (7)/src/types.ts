export interface DetectedObject {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export interface BodyKeypoints {
  head: { x: number; y: number; label: string };
  torso: { x: number; y: number; label: string };
  legs: { x: number; y: number; label: string };
}

export interface TrackedPerson {
  id: number;
  cx: number;
  cy: number;
  prevCy: number;
  vx: number;
  vy: number;
  bbox: [number, number, number, number];
  smoothedBbox: [number, number, number, number];
  lostFrames: number;
  totalVisibleFrames: number;
  score: number;
  hasCrossedIn: boolean;
  hasCrossedOut: boolean;
  history: { x: number; y: number }[];
  keypoints: BodyKeypoints;
  activePart: 'head' | 'torso' | 'legs' | 'full';
}

export interface CrossingEvent {
  id: string;
  type: 'in' | 'out';
  timestamp: string;
  personId: number;
}

export type ModelLoadingStatus = 'idle' | 'loading' | 'ready' | 'error';
export type CameraStatus = 'idle' | 'requesting' | 'active' | 'paused' | 'error';

export type BusOccupancyStatus = 'free' | 'filling' | 'overcrowded';

