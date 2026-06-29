export interface Point {
  x: number;
  y: number;
}

export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalibrationState {
  pixelsPerMillimeter: number;
  caliperA: Point;
  caliperB: Point;
  spanMm: number;
  isValid: boolean;
  referenceCircleCenter: Point; // visually placed over the ruler for visual check
  isLocked: boolean; // Workflow 2.0: locks the calibrated circle diameter
}

export interface BulletState {
  center: Point | null; // User adjustable center (starts as auto-detected)
  detectedCenter: Point | null; // Original computer-vision detected center
  roi: ROI | null;
  contour: Point[];
  convexHull: Point[];
  holeRadiusPixels: number;
  isCustomCenter: boolean;
  manualPoints?: Point[]; // Manual boundary points clicked by referee
  isLocked?: boolean;
  hidePoints?: boolean;
}

export interface TargetRing {
  score: number;
  radiusMm: number; // radius in mm
  color: string;
}

export interface CurveState {
  points: Point[];
  isLocked: boolean;
  isHidden: boolean;
  color: string;
  thickness: number;
}

export interface ScoringLineState {
  center: Point; // Center of the target rings
  selectedRingScore: number; // e.g., 10, 9, 8
  boundaryRadiusPixels: number; // inner edge toward higher score side
  isCustomBoundary: boolean;
  roi: ROI | null;
  curve?: CurveState;
}

export interface AppImage {
  name: string;
  url: string;
  width: number;
  height: number;
  rotation: number; // in degrees: 0, 90, 180, 270
}

export enum ActiveTool {
  None = 'None',
  PanZoom = 'PanZoom',
  Calibrate = 'Calibrate',
  BulletROI = 'BulletROI',
  LineROI = 'LineROI',
  AdjustBullet = 'AdjustBullet',
  AdjustBoundary = 'AdjustBoundary',
  PlaceRefCircle = 'PlaceRefCircle',
  BulletPoints = 'BulletPoints',
  CurveFinder = 'CurveFinder',
}
