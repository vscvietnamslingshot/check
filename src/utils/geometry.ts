import { Point } from '../types';

/**
 * Sorts points by their polar angle relative to their geometric mean (rough center).
 * This connects them in a clean, non-self-intersecting closed loop.
 */
export function sortPointsAngularly(points: Point[]): Point[] {
  if (points.length < 3) return points;

  // Calculate geometric mean
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  return [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });
}

/**
 * Computes the centroid (center of mass) of a non-self-intersecting closed polygon.
 * If the points are less than 3, returns the mean point.
 */
export function calculatePolygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  if (points.length === 2) {
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }

  // Ensure points form a clean polygon shape by sorting angularly
  const sorted = sortPointsAngularly(points);

  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = sorted.length;

  for (let i = 0; i < n; i++) {
    const p1 = sorted[i];
    const p2 = sorted[(i + 1) % n];
    const factor = p1.x * p2.y - p2.x * p1.y;
    area += factor;
    cx += (p1.x + p2.x) * factor;
    cy += (p1.y + p2.y) * factor;
  }

  area = area / 2;
  if (Math.abs(area) < 1e-5) {
    // Fallback: simple average of all vertices
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  cx = cx / (6 * area);
  cy = cy / (6 * area);

  return { x: cx, y: cy };
}

/**
 * Checks if a point is inside a polygon using the Ray-Casting algorithm.
 */
export function isPointInPolygon(pt: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = ((yi > pt.y) !== (yj > pt.y))
        && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes a smooth, open Catmull-Rom spline passing through the points in their sequential order.
 */
export function getOpenSplinePoints(points: Point[], stepsPerSegment: number = 24): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];
  if (points.length === 2) {
    const spline: Point[] = [];
    for (let step = 0; step <= stepsPerSegment; step++) {
      const t = step / stepsPerSegment;
      spline.push({
        x: points[0].x + t * (points[1].x - points[0].x),
        y: points[0].y + t * (points[1].y - points[0].y),
      });
    }
    return spline;
  }

  if (points.length === 3) {
    const p1 = points[0];
    const p2 = points[1]; // the bending point (midpoint)
    const p3 = points[2];

    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;

    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

    if (Math.abs(D) < 1e-3) {
      // Collinear fallback: straight line p1 -> p2 -> p3
      const spline: Point[] = [];
      const steps = stepsPerSegment;
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        spline.push({
          x: x1 + t * (x2 - x1),
          y: y1 + t * (y2 - y1),
        });
      }
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        spline.push({
          x: x2 + t * (x3 - x2),
          y: y2 + t * (y3 - y2),
        });
      }
      return spline;
    }

    const xc = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
    const yc = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
    const R = Math.hypot(x1 - xc, y1 - yc);

    const theta1 = Math.atan2(y1 - yc, x1 - xc);
    const theta2 = Math.atan2(y2 - yc, x2 - xc);
    const theta3 = Math.atan2(y3 - yc, x3 - xc);

    const diff12 = (theta2 - theta1 + 4 * Math.PI) % (2 * Math.PI);
    const diff23 = (theta3 - theta2 + 4 * Math.PI) % (2 * Math.PI);
    const diff13 = (theta3 - theta1 + 4 * Math.PI) % (2 * Math.PI);

    let isCounterClockwise = false;
    let sweepAngle = 0;

    if (Math.abs(diff12 + diff23 - diff13) < 1e-3) {
      isCounterClockwise = true;
      sweepAngle = diff13;
    } else {
      isCounterClockwise = false;
      sweepAngle = 2 * Math.PI - diff13;
    }

    const spline: Point[] = [];
    const totalSteps = stepsPerSegment * 2;
    for (let step = 0; step <= totalSteps; step++) {
      const t = step / totalSteps;
      const angle = isCounterClockwise 
        ? theta1 + t * sweepAngle 
        : theta1 - t * sweepAngle;
      spline.push({
        x: xc + R * Math.cos(angle),
        y: yc + R * Math.sin(angle),
      });
    }
    return spline;
  }

  const n = points.length;
  const spline: Point[] = [];

  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const p0 = i === 0 ? { x: p1.x - (p2.x - p1.x), y: p1.y - (p2.y - p1.y) } : points[i - 1];
    const p3 = i === n - 2 ? { x: p2.x + (p2.x - p1.x), y: p2.y + (p2.y - p1.y) } : points[i + 2];

    for (let step = 0; step < stepsPerSegment; step++) {
      const t = step / stepsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );

      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );

      spline.push({ x, y });
    }
  }

  spline.push(points[n - 1]);
  return spline;
}

/**
 * Computes a smooth, closed Catmull-Rom spline passing through the sorted points.
 */
export function getClosedSplinePoints(points: Point[], stepsPerSegment: number = 24): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];
  if (points.length === 2) {
    // Return line segment forward and back
    return [points[0], points[1], points[0]];
  }

  // Ensure points form a clean cyclic shape
  const sorted = sortPointsAngularly(points);
  const n = sorted.length;
  const spline: Point[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = sorted[(i - 1 + n) % n];
    const p1 = sorted[i];
    const p2 = sorted[(i + 1) % n];
    const p3 = sorted[(i + 2) % n];

    for (let step = 0; step < stepsPerSegment; step++) {
      const t = step / stepsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );

      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );

      spline.push({ x, y });
    }
  }

  return spline;
}

/**
 * Calculates the shortest distance from a target point to any point on a spline.
 */
export function getMinimumDistanceToSpline(pt: Point, splinePoints: Point[]): number {
  if (splinePoints.length === 0) return Infinity;
  let minDistance = Infinity;
  for (const sPt of splinePoints) {
    const dist = Math.hypot(pt.x - sPt.x, pt.y - sPt.y);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}
