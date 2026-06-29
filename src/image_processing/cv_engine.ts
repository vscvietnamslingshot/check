import { Point, ROI } from '../types';

declare global {
  interface Window {
    cv?: any;
    Module?: any;
  }
}

let cvLoadingState: 'idle' | 'loading' | 'loaded' = 'idle';
const cvCallbacks: (() => void)[] = [];

// Dynamically load OpenCV.js from a list of redundant CDNs
export function loadOpenCV(onLoaded: () => void): void {
  if (window.cv && window.cv.Mat) {
    cvLoadingState = 'loaded';
    onLoaded();
    return;
  }

  if (cvLoadingState === 'loaded') {
    onLoaded();
    return;
  }

  if (cvLoadingState === 'loading') {
    cvCallbacks.push(onLoaded);
    return;
  }

  // Set state to loading and add callback to the queue
  cvLoadingState = 'loading';
  cvCallbacks.push(onLoaded);

  const urls = [
    'https://docs.opencv.org/4.5.4/opencv.js',
    'https://docs.opencv.org/4.5.0/opencv.js',
    'https://cdn.jsdelivr.net/npm/@techstardn/opencv-js@4.5.1-beta.1/opencv.js',
    'https://docs.opencv.org/3.4.0/opencv.js',
    'https://cdnjs.cloudflare.com/ajax/libs/opencv.js/4.5.1/opencv.js'
  ];

  function triggerLoaded() {
    cvLoadingState = 'loaded';
    while (cvCallbacks.length > 0) {
      const cb = cvCallbacks.shift();
      if (cb) {
        try {
          cb();
        } catch (e) {
          console.error('Error in OpenCV load callback:', e);
        }
      }
    }
  }

  // Set up callback before loading
  window.Module = {
    onRuntimeInitialized: () => {
      console.log('OpenCV.js is ready.');
      triggerLoaded();
    },
  };

  function tryLoad(index: number) {
    if (index >= urls.length) {
      console.error('All OpenCV.js CDN URLs failed. Using pure JS fallback.');
      cvLoadingState = 'idle';
      triggerLoaded();
      return;
    }

    // Remove existing script if it was created
    const existingScript = document.getElementById('opencv-js');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'opencv-js';
    script.src = urls[index];
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Some versions of opencv.js don't trigger onRuntimeInitialized immediately or require a check
      if (window.cv && window.cv.Mat) {
        console.log(`OpenCV.js successfully loaded from ${urls[index]}`);
        triggerLoaded();
      }
    };

    script.onerror = () => {
      console.warn(`Failed to load OpenCV.js from ${urls[index]}. Trying fallback ${index + 1}...`);
      tryLoad(index + 1);
    };

    document.body.appendChild(script);
  }

  tryLoad(0);
}

/**
 * Pure TypeScript fallback for bullet hole center detection.
 * Performs thresholding, contour finding, and centroid calculations using standard canvas pixel data.
 */
export function detectBulletCenterPureJS(
  canvas: HTMLCanvasElement,
  roi: ROI
): { center: Point; contour: Point[]; convexHull: Point[]; holeRadius: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { center: { x: roi.x + roi.width / 2, y: roi.y + roi.height / 2 }, contour: [], convexHull: [], holeRadius: 5 };
  }

  // 1. Get image data inside the ROI
  const imgData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
  const data = imgData.data;
  const w = roi.width;
  const h = roi.height;

  // 2. Grayscale & find dark threshold
  const gray = new Uint8Array(w * h);
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    // Grayscale: standard luma conversion
    const g = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
    gray[i] = g;
    if (g < minVal) minVal = g;
    if (g > maxVal) maxVal = g;
  }

  // Bullet holes are very dark compared to the paper target.
  // We set a threshold at 35% of the range from min to max, with a cap.
  const threshold = minVal + (maxVal - minVal) * 0.35;

  // 3. Find connected dark components / binary mask
  const binary = new Uint8Array(w * h);
  const darkPoints: Point[] = [];
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (gray[idx] <= threshold) {
        binary[idx] = 1;
        darkPoints.push({ x, y });
        sumX += x;
        sumY += y;
      } else {
        binary[idx] = 0;
      }
    }
  }

  if (darkPoints.length === 0) {
    // If no dark points found, return ROI center
    return {
      center: { x: roi.x + w / 2, y: roi.y + h / 2 },
      contour: [],
      convexHull: [],
      holeRadius: 5,
    };
  }

  // 4. Find the largest connected component (the bullet hole itself)
  const visited = new Uint8Array(w * h);
  let largestComponent: Point[] = [];

  for (let i = 0; i < darkPoints.length; i++) {
    const pt = darkPoints[i];
    const idx = pt.y * w + pt.x;
    if (visited[idx]) continue;

    // Run BFS to find this component
    const comp: Point[] = [];
    const queue: Point[] = [pt];
    visited[idx] = 1;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);

      // 4-neighborhood
      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 },
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h) {
          const nIdx = n.y * w + n.x;
          if (binary[nIdx] && !visited[nIdx]) {
            visited[nIdx] = 1;
            queue.push(n);
          }
        }
      }
    }

    if (comp.length > largestComponent.length) {
      largestComponent = comp;
    }
  }

  // Calculate geometric centroid of the largest component
  let compSumX = 0;
  let compSumY = 0;
  largestComponent.forEach((pt) => {
    compSumX += pt.x;
    compSumY += pt.y;
  });

  const cLocalX = compSumX / largestComponent.length;
  const cLocalY = compSumY / largestComponent.length;

  const centerInCanvas: Point = {
    x: roi.x + cLocalX,
    y: roi.y + cLocalY,
  };

  // Convert points back to canvas coordinates
  const contour = largestComponent.map((p) => ({ x: roi.x + p.x, y: roi.y + p.y }));

  // 5. Compute Convex Hull using Andrew's Monotone Chain Algorithm
  const sortedPoints = [...largestComponent].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const lower: Point[] = [];
  for (const p of sortedPoints) {
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sortedPoints.length - 1; i >= 0; i--) {
    const p = sortedPoints[i];
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  const hullLocal = lower.concat(upper);
  const convexHull = hullLocal.map((p) => ({ x: roi.x + p.x, y: roi.y + p.y }));

  // Estimate the radius in pixels: average distance from centroid to boundary points
  let avgDist = 0;
  if (hullLocal.length > 0) {
    let sumDist = 0;
    hullLocal.forEach((p) => {
      const dx = p.x - cLocalX;
      const dy = p.y - cLocalY;
      sumDist += Math.sqrt(dx * dx + dy * dy);
    });
    avgDist = sumDist / hullLocal.length;
  }

  return {
    center: centerInCanvas,
    contour,
    convexHull,
    holeRadius: avgDist > 2 ? avgDist : 6,
  };
}

function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Automatically analyze a selected Ruler ROI to detect scale (pixels per millimeter).
 * Scans a horizontal pixel row and finds valleys/peaks (dark millimeter ticks on white/light paper).
 */
export function autoCalibrateRulerPureJS(
  canvas: HTMLCanvasElement,
  roi: ROI
): { pixelsPerMm: number; ticks: number[] } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { pixelsPerMm: 0, ticks: [] };

  const imgData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
  const data = imgData.data;
  const w = roi.width;
  const h = roi.height;

  // Compile vertical average of intensities to cancel out noise/dirt
  const intensityProfile = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      // standard grayscale conversion
      sum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }
    intensityProfile[x] = sum / h;
  }

  // Detect valleys (dark lines representing tick marks)
  // Standard peaks finding on intensity profile (inverted, i.e., local minima)
  const valleys: { x: number; depth: number }[] = [];
  const windowSize = 3; // neighborhood for local minimum
  for (let x = windowSize; x < w - windowSize; x++) {
    const val = intensityProfile[x];
    let isMin = true;
    for (let d = -windowSize; d <= windowSize; d++) {
      if (intensityProfile[x + d] < val) {
        isMin = false;
        break;
      }
    }

    if (isMin) {
      // It's a local minimum (dark line). Let's calculate its depth relative to neighbor averages.
      let leftAvg = 0;
      let rightAvg = 0;
      for (let d = 1; d <= windowSize; d++) {
        leftAvg += intensityProfile[x - d];
        rightAvg += intensityProfile[x + d];
      }
      leftAvg /= windowSize;
      rightAvg /= windowSize;

      const prominence = Math.min(leftAvg - val, rightAvg - val);
      if (prominence > 4) { // prominence threshold to discard noise
        valleys.push({ x, depth: prominence });
      }
    }
  }

  // Filter valleys to ensure they look like regular ticks
  // Sort valleys by prominence/depth to find standard ruler ticks
  valleys.sort((a, b) => b.depth - a.depth);

  // Take up to top 15 valleys and sort them back by X position
  const mainTicks = valleys.slice(0, 15).map((v) => v.x).sort((a, b) => a - b);

  if (mainTicks.length < 2) {
    return { pixelsPerMm: 0, ticks: [] };
  }

  // Measure the distances between adjacent ticks
  const intervals: number[] = [];
  for (let i = 0; i < mainTicks.length - 1; i++) {
    intervals.push(mainTicks[i + 1] - mainTicks[i]);
  }

  // Find the median interval to eliminate outliers (e.g., if a tick was missed or noise was detected)
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];

  // Group intervals that are close to the median (say within 20%) to compute highly precise average
  const validIntervals = intervals.filter((d) => Math.abs(d - medianInterval) < medianInterval * 0.25);
  const averageIntervalPx = validIntervals.reduce((sum, v) => sum + v, 0) / validIntervals.length;

  // An interval usually represents 1mm on the standard target ruler.
  const pixelsPerMm = averageIntervalPx;

  return {
    pixelsPerMm: parseFloat(pixelsPerMm.toFixed(3)),
    ticks: mainTicks.map((x) => roi.x + x),
  };
}

/**
 * Fits a circles boundary inside the Scoring Line ROI.
 * Relies on edge detection and algebraic circle fitting.
 */
export function fitScoringLinePureJS(
  canvas: HTMLCanvasElement,
  roi: ROI
): { boundary: Point[]; fittedCircle: { x: number; y: number; radius: number } | null } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { boundary: [], fittedCircle: null };

  const imgData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
  const data = imgData.data;
  const w = roi.width;
  const h = roi.height;

  // Grayscale & Sobel Edge Detection
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
  }

  const edgePoints: Point[] = [];
  const sobelThresh = 40;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      // Sobel kernel filter
      const gx =
        -gray[(y - 1) * w + (x - 1)] +
        gray[(y - 1) * w + (x + 1)] -
        2 * gray[y * w + (x - 1)] +
        2 * gray[y * w + (x + 1)] -
        gray[(y + 1) * w + (x - 1)] +
        gray[(y + 1) * w + (x + 1)];

      const gy =
        -gray[(y - 1) * w + (x - 1)] -
        2 * gray[(y - 1) * w + x] -
        gray[(y - 1) * w + (x + 1)] +
        gray[(y + 1) * w + (x - 1)] +
        2 * gray[(y + 1) * w + x] +
        gray[(y + 1) * w + (x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > sobelThresh) {
        edgePoints.push({ x: roi.x + x, y: roi.y + y });
      }
    }
  }

  if (edgePoints.length < 5) {
    return { boundary: [], fittedCircle: null };
  }

  // Circle fitting on edgePoints using Kasa's Algebraic Circle Fit
  // Eq: x^2 + y^2 + B*x + C*y + D = 0
  // Centroid at (-B/2, -C/2), Radius = sqrt((B^2 + C^2)/4 - D)
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
  let sumXXX = 0, sumYYY = 0, sumXYY = 0, sumXXY = 0;
  const n = edgePoints.length;

  for (const p of edgePoints) {
    sumX += p.x;
    sumY += p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
    sumXY += p.x * p.y;
    sumXXX += p.x * p.x * p.x;
    sumYYY += p.y * p.y * p.y;
    sumXYY += p.x * p.y * p.y;
    sumXXY += p.x * p.x * p.y;
  }

  // Setup system of equations
  // M * A = Y
  // where A = [B, C, D]^T
  // This is a standard 3x3 linear system:
  // [ sumXX sumXY sumX ] [ B ]   [ -(sumXXX + sumXYY) ]
  // [ sumXY sumYY sumY ] [ C ] = [ -(sumXXY + sumYYY) ]
  // [ sumX  sumY  n    ] [ D ]   [ -(sumXX + sumYY)   ]

  const a11 = sumXX, a12 = sumXY, a13 = sumX;
  const a21 = sumXY, a22 = sumYY, a23 = sumY;
  const a31 = sumX,  a32 = sumY,  a33 = n;

  const b1 = -(sumXXX + sumXYY);
  const b2 = -(sumXXY + sumYYY);
  const b3 = -(sumXX + sumYY);

  // Solve using Cramer's rule
  const det =
    a11 * (a22 * a33 - a23 * a32) -
    a12 * (a21 * a33 - a23 * a31) +
    a13 * (a21 * a32 - a22 * a31);

  if (Math.abs(det) < 1e-5) {
    return { boundary: edgePoints, fittedCircle: null };
  }

  const detB =
    b1 * (a22 * a33 - a23 * a32) -
    a12 * (b2 * a33 - a23 * b3) +
    a13 * (b2 * a32 - a22 * b3);

  const detC =
    a11 * (b2 * a33 - a23 * b3) -
    b1 * (a21 * a33 - a23 * a31) +
    a13 * (a21 * b3 - b2 * a31);

  const detD =
    a11 * (a22 * b3 - b2 * a32) -
    a12 * (a21 * b3 - b2 * a31) +
    b1 * (a21 * a32 - a22 * a31);

  const B = detB / det;
  const C = detC / det;
  const D = detD / det;

  const cx = -B / 2;
  const cy = -C / 2;
  const r2 = (B * B + C * C) / 4 - D;

  if (r2 <= 0) {
    return { boundary: edgePoints, fittedCircle: null };
  }

  const radius = Math.sqrt(r2);

  return {
    boundary: edgePoints,
    fittedCircle: { x: cx, y: cy, radius },
  };
}
