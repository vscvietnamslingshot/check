import { Point } from '../types';

export interface SamplePreset {
  id: string;
  name: string;
  description: string;
  pixelsPerMm: number;
  ringCenter: Point;
  bulletCenter: Point;
  ringRadiiMm: Record<number, number>; // e.g., { 10: 15, 9: 30, 8: 45 }
  expectedResult: 'HIGHER SCORE' | 'LOWER SCORE';
  reason: string;
  generateUrl: () => string;
}

export const ringRadiiMm = {
  10: 15, // 10-ring: radius 15mm
  9: 30,  // 9-ring: radius 30mm
  8: 45,  // 8-ring: radius 45mm
  7: 60,  // 7-ring: radius 60mm
};

export function generateTargetImage(
  presetType: 'higher' | 'lower' | 'torn',
  pixelsPerMm: number = 8.0
): { url: string; bulletCenter: Point; ringCenter: Point } {
  const canvas = document.createElement('canvas');
  const width = 800;
  const height = 800;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { url: '', bulletCenter: { x: 0, y: 0 }, ringCenter: { x: 0, y: 0 } };

  const ringCenter: Point = { x: width / 2, y: height / 2 - 40 };

  // 1. Draw Paper Background
  ctx.fillStyle = '#fcfaf2'; // Warm ivory paper color
  ctx.fillRect(0, 0, width, height);

  // Add subtle paper grain/texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
  for (let i = 0; i < 2000; i++) {
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    ctx.fillRect(rx, ry, 1.5, 1.5);
  }

  // Draw some Target Header text
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#374151';
  ctx.textAlign = 'center';
  ctx.fillText('VIETNAM SLINGSHOT CHAMPIONSHIP (VSC) - OFFICIAL VAR TARGET', width / 2, 40);
  ctx.font = 'normal 10px monospace';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('Calibration Ruler: 1mm divisions. Standard Circle: 3.00 mm', width / 2, 58);

  // 2. Draw Printed Scoring Rings
  // Standard VSC target ring lines are black, with a thickness of about 0.8mm
  const ringThickness = 0.8 * pixelsPerMm;

  const scores = [7, 8, 9, 10];
  scores.forEach((score) => {
    const radiusMm = ringRadiiMm[score as keyof typeof ringRadiiMm];
    const radiusPx = radiusMm * pixelsPerMm;

    // Outer boundary of the scoring ring
    ctx.beginPath();
    ctx.arc(ringCenter.x, ringCenter.y, radiusPx, 0, 2 * Math.PI);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = ringThickness;
    ctx.stroke();

    // Score label numbers inside the lanes
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Put score labels on the 4 axes
    const offsetMm = radiusMm - 7.5; // put in the middle of the lane
    if (offsetMm > 0 && score < 10) {
      const offsetPx = offsetMm * pixelsPerMm;
      ctx.fillText(score.toString(), ringCenter.x + offsetPx, ringCenter.y);
      ctx.fillText(score.toString(), ringCenter.x - offsetPx, ringCenter.y);
      ctx.fillText(score.toString(), ringCenter.x, ringCenter.y + offsetPx);
      ctx.fillText(score.toString(), ringCenter.x, ringCenter.y - offsetPx);
    } else if (score === 10) {
      ctx.fillText('10', ringCenter.x, ringCenter.y);
    }
  });

  // 3. Draw Millimeter Ruler at the Bottom
  const rulerY = height - 120;
  const rulerStartX = 150;
  const totalLengthMm = 60;
  const rulerLengthPx = totalLengthMm * pixelsPerMm;

  // Draw baseline
  ctx.beginPath();
  ctx.moveTo(rulerStartX, rulerY);
  ctx.lineTo(rulerStartX + rulerLengthPx, rulerY);
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw ticks
  for (let mm = 0; mm <= totalLengthMm; mm++) {
    const tickX = rulerStartX + mm * pixelsPerMm;
    let tickHeight = 6;
    let isLabeled = false;

    if (mm % 10 === 0) {
      tickHeight = 14;
      isLabeled = true;
    } else if (mm % 5 === 0) {
      tickHeight = 10;
    }

    ctx.beginPath();
    ctx.moveTo(tickX, rulerY);
    ctx.lineTo(tickX, rulerY - tickHeight);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = mm % 5 === 0 ? 1.5 : 1.0;
    ctx.stroke();

    if (isLabeled) {
      ctx.font = '500 10px monospace';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      ctx.fillText(`${mm}`, tickX, rulerY + 14);
    }
  }

  // Label the ruler
  ctx.font = 'italic 10px system-ui, sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.textAlign = 'left';
  ctx.fillText('Printed Calibration Ruler (mm)', rulerStartX, rulerY - 20);

  // 4. Draw Bullet Hole
  // The VSC VAR standard circle is 3mm in diameter -> radius is 1.5mm.
  // The official scoring boundary for the 10-ring is its INNER edge.
  // The printed 10-ring has its center line at radius 15mm.
  // Since the printed line has thickness (0.8mm = ringThickness), the inner edge (higher score side)
  // is at radius R_inner = 15mm - (0.8mm / 2) = 14.6mm.
  // For a shot to touch/intersect the 10-ring scoring boundary:
  // The distance between bullet center and ring center must be <= R_inner + R_var
  // R_inner + R_var = 14.6mm + 1.5mm = 16.1mm.
  // Let's set the bullet centers exactly to create "Higher Score" and "Lower Score" conditions.

  const rInner10 = 15.0 - 0.4; // 14.6 mm
  const rVar = 1.5;            // 1.5 mm
  const thresholdDistanceMm = rInner10 + rVar; // 16.1 mm

  let bulletDistMm = 16.1; // default boundary
  let isTorn = false;

  if (presetType === 'higher') {
    // Touching: bullet center is at 15.95 mm from target center
    // 15.95 mm <= 16.1 mm -> HIGHER SCORE (intersects the 14.6mm boundary by 0.15mm)
    bulletDistMm = 15.95;
  } else if (presetType === 'lower') {
    // Missing: bullet center is at 16.25 mm from target center
    // 16.25 mm > 16.1 mm -> LOWER SCORE (misses the 14.6mm boundary by 0.15mm)
    bulletDistMm = 16.25;
  } else {
    // Torn bullet hole: center is at 15.90 mm (should be higher score)
    // but the actual tear has jagged irregular edges extending outward
    bulletDistMm = 15.90;
    isTorn = true;
  }

  // Place bullet hole on a 45-degree angle from center for visual interest
  const angle = Math.PI / 4; // 45 degrees
  const bulletCenter: Point = {
    x: ringCenter.x + bulletDistMm * pixelsPerMm * Math.cos(angle),
    y: ringCenter.y + bulletDistMm * pixelsPerMm * Math.sin(angle),
  };

  const holeRadiusMm = 1.25; // actual physical bullet hole size (often smaller than 3mm)
  const holeRadiusPx = holeRadiusMm * pixelsPerMm;

  if (isTorn) {
    // Draw an irregular torn bullet hole
    ctx.beginPath();
    const numPoints = 12;
    for (let i = 0; i < numPoints; i++) {
      const a = (i * 2 * Math.PI) / numPoints;
      // Add jaggedness to the radius
      const r = holeRadiusPx * (0.8 + Math.random() * 0.5);
      const px = bulletCenter.x + r * Math.cos(a);
      const py = bulletCenter.y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Fill with bullet hole colors: dark grey interior, charred edges
    ctx.fillStyle = '#27272a'; // dark carbonized fiber look
    ctx.fill();

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw some radial cracks/tears on paper
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.4)';
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 4; i++) {
      const crackAngle = angle + (Math.random() - 0.5) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(bulletCenter.x + holeRadiusPx * Math.cos(crackAngle), bulletCenter.y + holeRadiusPx * Math.sin(crackAngle));
      ctx.lineTo(
        bulletCenter.x + holeRadiusPx * 1.8 * Math.cos(crackAngle),
        bulletCenter.y + holeRadiusPx * 1.8 * Math.sin(crackAngle)
      );
      ctx.stroke();
    }
  } else {
    // Draw a perfect clean bullet hole
    // Inner hole (dark drop shadows)
    ctx.beginPath();
    ctx.arc(bulletCenter.x, bulletCenter.y, holeRadiusPx, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1b4b'; // deep navy/black representing bullet punch-through
    ctx.fill();

    // Lead smudge/grease ring (typical of bullet impact)
    ctx.beginPath();
    ctx.arc(bulletCenter.x, bulletCenter.y, holeRadiusPx + 1.2, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(31, 41, 55, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw some helpful calibration reference arrows or guide boxes to make it look highly professional
  // like an official technical document or diagnostic image
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bulletCenter.x - 30, bulletCenter.y - 30, 60, 60);

  return {
    url: canvas.toDataURL('image/png'),
    bulletCenter,
    ringCenter,
  };
}

export const presets: SamplePreset[] = [
  {
    id: 'target-10-touch',
    name: 'VSC Target A: Direct Touch (Higher Score)',
    description: 'The 3.00 mm VAR circle touches the 10-ring inner boundary by 0.15 mm. Result: HIGHER SCORE.',
    pixelsPerMm: 8.5,
    ringCenter: { x: 400, y: 360 },
    bulletCenter: { x: 0, y: 0 }, // calculated dynamically
    ringRadiiMm,
    expectedResult: 'HIGHER SCORE',
    reason: 'The VAR Circle (3.0mm) intersects the inner edge of the 10-ring (14.60mm) as the bullet center is at 15.95mm from target center.',
    generateUrl: function () {
      const res = generateTargetImage('higher', this.pixelsPerMm);
      this.bulletCenter = res.bulletCenter;
      this.ringCenter = res.ringCenter;
      return res.url;
    },
  },
  {
    id: 'target-10-miss',
    name: 'VSC Target B: Near Miss (Lower Score)',
    description: 'The VAR circle is 0.15 mm short of touching the 10-ring inner boundary. Result: LOWER SCORE.',
    pixelsPerMm: 8.5,
    ringCenter: { x: 400, y: 360 },
    bulletCenter: { x: 0, y: 0 },
    ringRadiiMm,
    expectedResult: 'LOWER SCORE',
    reason: 'The VAR Circle (3.0mm) does not touch the inner edge of the 10-ring (14.60mm) as the bullet center is at 16.25mm from target center.',
    generateUrl: function () {
      const res = generateTargetImage('lower', this.pixelsPerMm);
      this.bulletCenter = res.bulletCenter;
      this.ringCenter = res.ringCenter;
      return res.url;
    },
  },
  {
    id: 'target-10-torn',
    name: 'VSC Target C: Torn Hole (Higher Score)',
    description: 'An irregular torn bullet hole. Convex hull centers the shot. The VAR circle intersects the boundary.',
    pixelsPerMm: 9.0,
    ringCenter: { x: 400, y: 360 },
    bulletCenter: { x: 0, y: 0 },
    ringRadiiMm,
    expectedResult: 'HIGHER SCORE',
    reason: 'Despite irregular tearing, the convex hull isolates the true projectile center (15.90mm) allowing the VAR circle to touch the 10-ring inner boundary.',
    generateUrl: function () {
      const res = generateTargetImage('torn', this.pixelsPerMm);
      this.bulletCenter = res.bulletCenter;
      this.ringCenter = res.ringCenter;
      return res.url;
    },
  },
];
