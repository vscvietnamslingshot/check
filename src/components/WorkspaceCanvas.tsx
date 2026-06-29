import React, { useRef, useEffect, useState } from 'react';
import { ActiveTool, Point, ROI, CalibrationState, BulletState, ScoringLineState, AppImage } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Layers } from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { sortPointsAngularly, calculatePolygonCentroid, getOpenSplinePoints } from '../utils/geometry';

interface WorkspaceCanvasProps {
  currentImage: AppImage | null;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  calibration: CalibrationState;
  setCalibration: React.Dispatch<React.SetStateAction<CalibrationState>>;
  bullet: BulletState;
  setBullet: React.Dispatch<React.SetStateAction<BulletState>>;
  scoringLine: ScoringLineState;
  setScoringLine: React.Dispatch<React.SetStateAction<ScoringLineState>>;
  rotation: number;
  language: Language;
}

export default function WorkspaceCanvas({
  currentImage,
  activeTool,
  setActiveTool,
  calibration,
  setCalibration,
  bullet,
  setBullet,
  scoringLine,
  setScoringLine,
  rotation,
  language,
}: WorkspaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  // Viewport State (Zoom & Pan)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  // Mouse State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  // ROI Drawing State
  const [roiStart, setRoiStart] = useState<Point | null>(null);
  const [roiCurrent, setRoiCurrent] = useState<Point | null>(null);

  // Dragging Specific Elements State
  const [activeDragElement, setActiveDragElement] = useState<'caliperA' | 'caliperB' | 'crosshair' | 'refCircle' | 'boundaryRadius' | 'ringCenter' | null>(null);
  const [draggedManualPointIndex, setDraggedManualPointIndex] = useState<number | null>(null);
  const [draggedCurvePointIndex, setDraggedCurvePointIndex] = useState<number | null>(null);

  // Load image element
  useEffect(() => {
    if (!currentImage) {
      setImageElement(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentImage.url;
    img.onload = () => {
      setImageElement(img);
      // Reset zoom/pan to fit the image
      if (containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const scale = Math.min((cw - 60) / img.width, (ch - 60) / img.height, 1.5);
        setZoom(scale);
        setPan({
          x: (cw - img.width * scale) / 2,
          y: (ch - img.height * scale) / 2,
        });
      }
    };
  }, [currentImage]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!imageElement || !containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const scale = Math.min((cw - 60) / imageElement.width, (ch - 60) / imageElement.height, 1.5);
      setZoom(scale);
      setPan({
        x: (cw - imageElement.width * scale) / 2,
        y: (ch - imageElement.height * scale) / 2,
      });
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [imageElement]);

  // Convert client-space screen coordinates to raw Image coordinates
  const screenToImage = (screenX: number, screenY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;

    // Remove Pan/Zoom offsets
    const imgX = (x - pan.x) / zoom;
    const imgY = (y - pan.y) / zoom;

    // Apply rotation transforms back if rotated
    // For now, rotation is simulated by CSS or drawn rotated. We draw rotated, so we transform:
    // Let's keep math clean. We'll draw the image rotated inside the canvas.
    return { x: imgX, y: imgY };
  };

  // Convert raw image coordinates to screen space coordinates on canvas
  const imageToScreen = (imgX: number, imgY: number): Point => {
    const x = imgX * zoom + pan.x;
    const y = imgY * zoom + pan.y;
    return { x, y };
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    // Set canvas dimensions to match container exactly
    const dpr = window.devicePixelRatio || 1;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Clear Canvas
    ctx.fillStyle = '#0F1012'; // Dark dashboard background
    ctx.fillRect(0, 0, width, height);

    if (!imageElement) {
      // Draw Placeholder greeting inside Canvas
      ctx.font = '500 11px monospace';
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      ctx.fillText(
        language === 'en'
          ? 'SELECT AN OFFICIAL VSC PRESET OR UPLOAD A TARGET TO START ANALYSIS'
          : 'CHỌN BIA VSC MẪU HOẶC TẢI LÊN ẢNH BIA ĐỂ BẮT ĐẦU PHÂN TÍCH',
        width / 2,
        height / 2
      );
      return;
    }

    // Save Context for image transformation
    ctx.save();

    // 1. Render the main Target Image under Pan/Zoom/Rotation
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Handle Rotation at the center of the image
    const iw = imageElement.width;
    const ih = imageElement.height;
    ctx.translate(iw / 2, ih / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-iw / 2, -ih / 2);

    ctx.drawImage(imageElement, 0, 0);

    // Restore context so we can draw interactive overlays
    // Drawn in the same coordinate system as the image, making placement robust!
    ctx.restore();

    // Draw all our overlays using image-space coordinates
    // We transform them to screen-space for pixel-perfect overlays!
    // Draw all our overlays using image-space coordinates
    // We transform them to screen-space for pixel-perfect overlays!
    const drawInteractiveOverlays = () => {
      // Helper to translate coordinate considering rotation
      const getRotatedPoint = (pt: Point): Point => {
        // Calculate point relative to image center
        const cx = iw / 2;
        const cy = ih / 2;
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const rad = (rotation * Math.PI) / 180;

        const rx = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
        const ry = cy + dx * Math.sin(rad) + dy * Math.cos(rad);

        return imageToScreen(rx, ry);
      };

      // 1. Draw Ruler Calibration Circle (Step 5 & 7)
      if (calibration.isValid) {
        const refScr = getRotatedPoint(calibration.referenceCircleCenter);
        const varRadPx = 1.5 * calibration.pixelsPerMillimeter * zoom;

        ctx.beginPath();
        ctx.arc(refScr.x, refScr.y, varRadPx, 0, 2 * Math.PI);
        ctx.strokeStyle = calibration.isLocked ? '#3b82f6' : '#f97316'; // Blue if locked, orange if editing
        ctx.lineWidth = calibration.isLocked ? 2.0 : 3.0;
        if (!calibration.isLocked) {
          ctx.setLineDash([3, 3]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Label text for Calibration Circle
        ctx.font = 'bold 9px font-mono, sans-serif';
        ctx.fillStyle = calibration.isLocked ? '#93c5fd' : '#fed7aa';
        ctx.textAlign = 'center';
        ctx.fillText(
          calibration.isLocked ? translations[language].canvasRefCircleLocked : translations[language].canvasRefCircleUnlocked,
          refScr.x,
          refScr.y - varRadPx - 8
        );

        // Center Move handle 'M'
        if (!calibration.isLocked && activeTool === ActiveTool.Calibrate) {
          ctx.beginPath();
          ctx.arc(refScr.x, refScr.y, 9, 0, 2 * Math.PI);
          ctx.fillStyle = '#2563eb';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('M', refScr.x, refScr.y);
        } else {
          // simple tiny center dot
          ctx.beginPath();
          ctx.arc(refScr.x, refScr.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = calibration.isLocked ? '#3b82f6' : '#f97316';
          ctx.fill();
        }

        // Radius Resize handle 'S' (Size) on the right edge
        if (!calibration.isLocked && activeTool === ActiveTool.Calibrate) {
          const handleScrX = refScr.x + varRadPx;
          const handleScrY = refScr.y;

          ctx.beginPath();
          ctx.arc(handleScrX, handleScrY, 9, 0, 2 * Math.PI);
          ctx.fillStyle = '#ea580c';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', handleScrX, handleScrY);
        }
      }

      // 2. Draw Bullet ROI (Step 3)
      if (bullet.roi) {
        // Draw ROI rectangle in image space
        const tl = getRotatedPoint({ x: bullet.roi.x, y: bullet.roi.y });
        const br = getRotatedPoint({ x: bullet.roi.x + bullet.roi.width, y: bullet.roi.y + bullet.roi.height });

        ctx.strokeStyle = '#ef4444'; // Red for bullet hole region
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.setLineDash([]);

        ctx.font = '500 9px font-mono, sans-serif';
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'left';
        ctx.fillText(translations[language].canvasBulletRoi, tl.x + 4, tl.y - 4);
      }

      // 3. Draw Bullet Center Crosshair & Cloned 3mm VAR Circle (Step 8 & 9 - only after Lock Scale!)
      if (bullet.center && calibration.isValid) {
        const bulletScr = getRotatedPoint(bullet.center);

        // Draw crosshair lines (Thin RED lines spanning 50px)
        const size = 30;
        ctx.beginPath();
        ctx.moveTo(bulletScr.x - size, bulletScr.y);
        ctx.lineTo(bulletScr.x + size, bulletScr.y);
        ctx.moveTo(bulletScr.x, bulletScr.y - size);
        ctx.lineTo(bulletScr.x, bulletScr.y + size);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Draggable target center dot
        ctx.beginPath();
        ctx.arc(bulletScr.x, bulletScr.y, (activeTool === ActiveTool.AdjustBullet || activeTool === ActiveTool.BulletPoints) ? 7 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        // Draw standard 3mm VAR Circle centered over the bullet hole
        if (calibration.isLocked) {
          const varRadPx = 1.5 * calibration.pixelsPerMillimeter * zoom;
          ctx.beginPath();
          ctx.arc(bulletScr.x, bulletScr.y, varRadPx, 0, 2 * Math.PI);
          ctx.strokeStyle = '#ef4444'; // Red VAR Circle
          ctx.lineWidth = 2.5;
          ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
          ctx.shadowBlur = 4;
          ctx.stroke();
          ctx.shadowBlur = 0; // reset

          // Draw text overlay for VAR Circle
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#fca5a5';
          ctx.textAlign = 'center';
          ctx.fillText(translations[language].canvasClonedVar, bulletScr.x, bulletScr.y - varRadPx - 5);
        }
      }

      // 3b. Draw Manual Polygon Clicker points & lines (Tìm tâm đạn)
      if (bullet.manualPoints && bullet.manualPoints.length > 0 && !bullet.hidePoints) {
        const sortedPoints = sortPointsAngularly(bullet.manualPoints);
        const screenPts = sortedPoints.map(p => getRotatedPoint(p));

        // 1. Draw the closed polygon
        if (screenPts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(screenPts[0].x, screenPts[0].y);
          for (let i = 1; i < screenPts.length; i++) {
            ctx.lineTo(screenPts[i].x, screenPts[i].y);
          }
          ctx.closePath();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.fill();
          ctx.stroke();
        }

        // 2. Draw thin opposition support lines between opposite areas of the polygon
        if (screenPts.length >= 4) {
          const n = screenPts.length;
          const half = Math.floor(n / 2);
          ctx.beginPath();
          for (let i = 0; i < half; i++) {
            const oppIdx = (i + half) % n;
            ctx.moveTo(screenPts[i].x, screenPts[i].y);
            ctx.lineTo(screenPts[oppIdx].x, screenPts[oppIdx].y);
          }
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 3. Draw numbered markers at each point
        bullet.manualPoints.forEach((pt, idx) => {
          const sPt = getRotatedPoint(pt);
          
          // Draw a small bright orange solid circle
          ctx.beginPath();
          ctx.arc(sPt.x, sPt.y, 8, 0, 2 * Math.PI);
          ctx.fillStyle = '#F27D26';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();

          // Draw the index number
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((idx + 1).toString(), sPt.x, sPt.y);
        });
      }

      // 4. Draw Scoring Line ROI (Step 4)
      if (scoringLine.roi) {
        const tl = getRotatedPoint({ x: scoringLine.roi.x, y: scoringLine.roi.y });
        const br = getRotatedPoint({ x: scoringLine.roi.x + scoringLine.roi.width, y: scoringLine.roi.y + scoringLine.roi.height });

        ctx.strokeStyle = '#10b981'; // Green for scoring line
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.setLineDash([]);

        ctx.font = '500 9px font-mono, sans-serif';
        ctx.fillStyle = '#a7f3d0';
        ctx.textAlign = 'left';
        ctx.fillText(language === 'en' ? 'RING ROI' : 'VÙNG VÒNG ĐIỂM', tl.x + 4, tl.y - 4);
      }

      // 5. Draw Fitted Scoring Line (Green Boundary)
      const isCurveActive = !!(scoringLine.curve && scoringLine.curve.points.length >= 3);
      if (scoringLine.boundaryRadiusPixels > 0 && !isCurveActive) {
        const ringScr = getRotatedPoint(scoringLine.center);
        const ringRadPx = scoringLine.boundaryRadiusPixels * zoom;

        ctx.beginPath();
        ctx.arc(ringScr.x, ringScr.y, ringRadPx, 0, 2 * Math.PI);
        ctx.strokeStyle = '#10b981'; // Green scoring boundary
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Label Scoring line boundary
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#a7f3d0';
        ctx.textAlign = 'center';
        ctx.fillText(
          translations[language].canvasInnerEdge.replace('{score}', scoringLine.selectedRingScore.toString()),
          ringScr.x,
          ringScr.y - ringRadPx - 6
        );

        // Draw center of target rings
        ctx.beginPath();
        ctx.arc(ringScr.x, ringScr.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#10b981';
        ctx.fill();

        // Handle for adjusting boundary radius (draw on the right edge of the ring)
        if (activeTool === ActiveTool.AdjustBoundary) {
          // Inner edge interactive caliper handle on the circle boundary
          const handleScrX = ringScr.x + ringRadPx;
          const handleScrY = ringScr.y;

          ctx.beginPath();
          ctx.arc(handleScrX, handleScrY, 8, 0, 2 * Math.PI);
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px system-ui';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('R', handleScrX, handleScrY + 3);

          // Draw an interactive handle at the center as well to let user translate the ring center if necessary
          ctx.beginPath();
          ctx.arc(ringScr.x, ringScr.y, 8, 0, 2 * Math.PI);
          ctx.fillStyle = '#047857';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px system-ui';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('C', ringScr.x, ringScr.y + 3);
        }
      }

      // 5b. Draw Custom Curve (Spline Curve Finder)
      if (scoringLine.curve && scoringLine.curve.points.length > 0 && !scoringLine.curve.isHidden) {
        const curveColor = scoringLine.curve.color || '#10b981';
        const curveThickness = scoringLine.curve.thickness || 3;
        const pts = scoringLine.curve.points;

        // 1. Draw smooth spline curve if >= 3 points
        if (pts.length >= 3) {
          const splinePts = getOpenSplinePoints(pts);
          const screenSplinePts = splinePts.map(p => getRotatedPoint(p));

          ctx.beginPath();
          ctx.moveTo(screenSplinePts[0].x, screenSplinePts[0].y);
          for (let i = 1; i < screenSplinePts.length; i++) {
            ctx.lineTo(screenSplinePts[i].x, screenSplinePts[i].y);
          }
          ctx.strokeStyle = curveColor;
          ctx.lineWidth = curveThickness;
          ctx.shadowColor = curveColor;
          ctx.shadowBlur = 4;
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        }

        // 2. Draw thin polyline connecting the points
        if (pts.length >= 2) {
          ctx.beginPath();
          const firstScr = getRotatedPoint(pts[0]);
          ctx.moveTo(firstScr.x, firstScr.y);
          for (let i = 1; i < pts.length; i++) {
            const nextScr = getRotatedPoint(pts[i]);
            ctx.lineTo(nextScr.x, nextScr.y);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 3. Draw small numbered markers at each point
        pts.forEach((pt, idx) => {
          const sPt = getRotatedPoint(pt);

          // Circle background
          ctx.beginPath();
          ctx.arc(sPt.x, sPt.y, 7, 0, 2 * Math.PI);
          ctx.fillStyle = curveColor;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.fill();
          ctx.stroke();

          // Text number
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((idx + 1).toString(), sPt.x, sPt.y);
        });
      }

      // Draw ROI creation bounding box (dynamic while drawing)
      if (roiStart && roiCurrent && (activeTool === ActiveTool.BulletROI || activeTool === ActiveTool.LineROI)) {
        ctx.strokeStyle = activeTool === ActiveTool.BulletROI ? '#ef4444' : '#10b981';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(roiStart.x, roiStart.y, roiCurrent.x - roiStart.x, roiCurrent.y - roiStart.y);
        ctx.setLineDash([]);
      }
    };

    drawInteractiveOverlays();
  }, [
    imageElement,
    zoom,
    pan,
    rotation,
    calibration,
    bullet,
    scoringLine,
    activeTool,
    roiStart,
    roiCurrent,
  ]);

  // Handle Zoom operations
  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.1), 15));
  };

  const handleZoomToFit = () => {
    if (!imageElement || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scale = Math.min((cw - 60) / imageElement.width, (ch - 60) / imageElement.height, 1.5);
    setZoom(scale);
    setPan({
      x: (cw - imageElement.width * scale) / 2,
      y: (ch - imageElement.height * scale) / 2,
    });
  };

  // Mouse/Touch Interaction Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const imgPt = screenToImage(e.clientX, e.clientY);

    // Check if middle click or Spacebar is pressed, or in PanMode
    if (e.button === 1 || activeTool === ActiveTool.PanZoom) {
      setIsDragging(true);
      setDragStart({ x: screenX, y: screenY });
      setDragOffset({ ...pan });
      return;
    }

    // 1. Calibration Circle interaction (only when not locked)
    if (activeTool === ActiveTool.Calibrate && !calibration.isLocked) {
      const distCenter = Math.hypot(imgPt.x - calibration.referenceCircleCenter.x, imgPt.y - calibration.referenceCircleCenter.y);
      const varRadPx = 1.5 * calibration.pixelsPerMillimeter;
      const handleX = calibration.referenceCircleCenter.x + varRadPx;
      const handleY = calibration.referenceCircleCenter.y;
      const distRadius = Math.hypot(imgPt.x - handleX, imgPt.y - handleY);

      const hitRadius = 15 / zoom;

      if (distRadius < hitRadius) {
        setActiveDragElement('refCircleRadius');
        setIsDragging(true);
        return;
      } else if (distCenter < hitRadius) {
        setActiveDragElement('refCircleCenter');
        setIsDragging(true);
        return;
      }
    }

    // 2. Draggable Bullet Center Crosshair interaction (only after Lock Scale)
    if (activeTool === ActiveTool.AdjustBullet && bullet.center && calibration.isLocked) {
      const dist = Math.hypot(imgPt.x - bullet.center.x, imgPt.y - bullet.center.y);
      if (dist < 15 / zoom) {
        setActiveDragElement('crosshair');
        setIsDragging(true);
        return;
      }
    }

    // 3. Draggable Ring Inner Edge radius & Center
    if (activeTool === ActiveTool.AdjustBoundary && scoringLine.boundaryRadiusPixels > 0) {
      // Calculate distance to ring center
      const distCenter = Math.hypot(imgPt.x - scoringLine.center.x, imgPt.y - scoringLine.center.y);

      // Check distance to ring radius handle (located at RingCenter + Radius on X-axis)
      const handleX = scoringLine.center.x + scoringLine.boundaryRadiusPixels;
      const handleY = scoringLine.center.y;
      const distHandle = Math.hypot(imgPt.x - handleX, imgPt.y - handleY);

      if (distHandle < 15 / zoom) {
        setActiveDragElement('boundaryRadius');
        setIsDragging(true);
        return;
      } else if (distCenter < 15 / zoom) {
        setActiveDragElement('ringCenter');
        setIsDragging(true);
        return;
      }
    }

    // 4. BulletPoints Manual Locator interaction (Tìm tâm đạn)
    if (activeTool === ActiveTool.BulletPoints) {
      const manualPts = bullet.manualPoints || [];
      let hitIndex = -1;
      const hitThreshold = 12 / zoom; // 12 pixels on canvas

      for (let i = 0; i < manualPts.length; i++) {
        const dist = Math.hypot(imgPt.x - manualPts[i].x, imgPt.y - manualPts[i].y);
        if (dist < hitThreshold) {
          hitIndex = i;
          break;
        }
      }

      if (hitIndex !== -1) {
        setDraggedManualPointIndex(hitIndex);
        setIsDragging(true);
      } else {
        // Add a new point at click position
        const updatedPoints = [...manualPts, imgPt];
        const newCenter = calculatePolygonCentroid(updatedPoints);
        setBullet((prev) => ({
          ...prev,
          manualPoints: updatedPoints,
          center: newCenter,
          isCustomCenter: true,
        }));
        // Select it for dragging immediately if desired
        setDraggedManualPointIndex(updatedPoints.length - 1);
        setIsDragging(true);
      }
      return;
    }

    // 4b. CurveFinder Manual Locator interaction (Tìm Đường cong)
    if (activeTool === ActiveTool.CurveFinder) {
      if (scoringLine.curve?.isLocked) return;
      const curvePts = scoringLine.curve?.points || [];
      let hitIndex = -1;
      const hitThreshold = 12 / zoom; // 12 pixels on canvas

      for (let i = 0; i < curvePts.length; i++) {
        const dist = Math.hypot(imgPt.x - curvePts[i].x, imgPt.y - curvePts[i].y);
        if (dist < hitThreshold) {
          hitIndex = i;
          break;
        }
      }

      if (hitIndex !== -1) {
        setDraggedCurvePointIndex(hitIndex);
        setIsDragging(true);
      } else {
        if (curvePts.length === 0) {
          // Point 1 (Start)
          const updatedPoints = [imgPt];
          setScoringLine((prev) => ({
            ...prev,
            curve: {
              ...prev.curve!,
              points: updatedPoints,
            },
          }));
          setDraggedCurvePointIndex(0);
          setIsDragging(true);
        } else if (curvePts.length === 1) {
          // Point 3 (End) + automatic Middle Point (Point 2) at the midpoint
          const startPt = curvePts[0];
          const midPt = {
            x: (startPt.x + imgPt.x) / 2,
            y: (startPt.y + imgPt.y) / 2,
          };
          const updatedPoints = [startPt, midPt, imgPt];
          setScoringLine((prev) => ({
            ...prev,
            curve: {
              ...prev.curve!,
              points: updatedPoints,
            },
          }));
          // Immediately drag the middle point to shape the curve
          setDraggedCurvePointIndex(1);
          setIsDragging(true);
        } else {
          // If a 3-point curve already exists, clicking far away resets and starts a new one
          const updatedPoints = [imgPt];
          setScoringLine((prev) => ({
            ...prev,
            curve: {
              ...prev.curve!,
              points: updatedPoints,
            },
          }));
          setDraggedCurvePointIndex(0);
          setIsDragging(true);
        }
      }
      return;
    }

    // 4. Draw ROI rectangle
    if (activeTool === ActiveTool.BulletROI || activeTool === ActiveTool.LineROI) {
      setIsDragging(true);
      setRoiStart({ x: screenX, y: screenY });
      setRoiCurrent({ x: screenX, y: screenY });
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !imageElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const imgPt = screenToImage(e.clientX, e.clientY);

    // 1. Pan Action
    if (activeTool === ActiveTool.PanZoom || e.buttons === 4) {
      const dx = screenX - dragStart.x;
      const dy = screenY - dragStart.y;
      setPan({
        x: dragOffset.x + dx,
        y: dragOffset.y + dy,
      });
      return;
    }

    // Drag manual point
    if (draggedManualPointIndex !== null && imageElement) {
      setBullet((prev) => {
        const pts = [...(prev.manualPoints || [])];
        if (draggedManualPointIndex >= 0 && draggedManualPointIndex < pts.length) {
          pts[draggedManualPointIndex] = imgPt;
          const newCenter = calculatePolygonCentroid(pts);
          return {
            ...prev,
            manualPoints: pts,
            center: newCenter,
            isCustomCenter: true,
          };
        }
        return prev;
      });
      return;
    }

    // Drag curve point
    if (draggedCurvePointIndex !== null && imageElement && !scoringLine.curve?.isLocked) {
      setScoringLine((prev) => {
        const pts = [...(prev.curve?.points || [])];
        if (draggedCurvePointIndex >= 0 && draggedCurvePointIndex < pts.length) {
          pts[draggedCurvePointIndex] = imgPt;
          return {
            ...prev,
            curve: {
              ...prev.curve!,
              points: pts,
            },
          };
        }
        return prev;
      });
      return;
    }

    // 2. Drag interactive elements
    if (activeDragElement === 'refCircleCenter') {
      setCalibration((prev) => ({
        ...prev,
        referenceCircleCenter: imgPt,
      }));
      return;
    }

    if (activeDragElement === 'refCircleRadius') {
      setCalibration((prev) => {
        const rPx = Math.hypot(imgPt.x - prev.referenceCircleCenter.x, imgPt.y - prev.referenceCircleCenter.y);
        const safeRPx = Math.max(2, rPx);
        // Since radius corresponds to 1.5mm on physical scale, pixelsPerMm is safeRPx / 1.5
        const ppm = safeRPx / 1.5;
        return {
          ...prev,
          pixelsPerMillimeter: ppm,
        };
      });
      return;
    }

    if (activeDragElement === 'crosshair') {
      setBullet((prev) => ({
        ...prev,
        center: imgPt,
        isCustomCenter: true,
      }));
      return;
    }

    if (activeDragElement === 'ringCenter') {
      setScoringLine((prev) => ({
        ...prev,
        center: imgPt,
        isCustomBoundary: true,
      }));
      return;
    }

    if (activeDragElement === 'boundaryRadius') {
      setScoringLine((prev) => {
        const radiusPx = Math.hypot(imgPt.x - prev.center.x, imgPt.y - prev.center.y);
        return {
          ...prev,
          boundaryRadiusPixels: radiusPx,
          isCustomBoundary: true,
        };
      });
      return;
    }

    // 3. Draw ROI Box
    if (roiStart && (activeTool === ActiveTool.BulletROI || activeTool === ActiveTool.LineROI)) {
      setRoiCurrent({ x: screenX, y: screenY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    setActiveDragElement(null);

    if (draggedManualPointIndex !== null) {
      setDraggedManualPointIndex(null);
      return;
    }

    if (draggedCurvePointIndex !== null) {
      setDraggedCurvePointIndex(null);
      return;
    }

    // Save ROI coordinate box
    if (roiStart && roiCurrent && (activeTool === ActiveTool.BulletROI || activeTool === ActiveTool.LineROI)) {
      const ptStartImg = screenToImage(roiStart.x, roiStart.y);
      const ptCurrentImg = screenToImage(roiCurrent.x, roiCurrent.y);

      const x = Math.min(ptStartImg.x, ptCurrentImg.x);
      const y = Math.min(ptStartImg.y, ptCurrentImg.y);
      const w = Math.abs(ptStartImg.x - ptCurrentImg.x);
      const h = Math.abs(ptStartImg.y - ptCurrentImg.y);

      if (w > 5 && h > 5) {
        const roi: ROI = { x, y, width: w, height: h };
        if (activeTool === ActiveTool.BulletROI) {
          setBullet((prev) => ({
            ...prev,
            roi,
            center: null, // clear previous detection to prompt recompute
          }));
        } else {
          setScoringLine((prev) => ({
            ...prev,
            roi,
          }));
        }
      } else {
        // Single-click select near features (Option A)
        const clickCenter = ptStartImg;
        if (activeTool === ActiveTool.BulletROI) {
          const size = 90; // standard ROI box size
          const roi: ROI = {
            x: clickCenter.x - size / 2,
            y: clickCenter.y - size / 2,
            width: size,
            height: size,
          };
          setBullet((prev) => ({
            ...prev,
            roi,
            center: null,
          }));
        } else if (activeTool === ActiveTool.LineROI) {
          const size = 160; // standard Ring ROI box size
          const roi: ROI = {
            x: clickCenter.x - size / 2,
            y: clickCenter.y - size / 2,
            width: size,
            height: size,
          };
          setScoringLine((prev) => ({
            ...prev,
            roi,
          }));
        }
      }

      // Revert tool back to default Pan/Zoom mode once ROI selection is drawn
      setActiveTool(ActiveTool.PanZoom);
      setRoiStart(null);
      setRoiCurrent(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageElement) return;

    const imgPt = screenToImage(e.clientX, e.clientY);
    const hitThreshold = 12 / zoom; // 12 pixels on canvas

    if (activeTool === ActiveTool.BulletPoints) {
      const manualPts = bullet.manualPoints || [];
      let hitIndex = -1;
      for (let i = 0; i < manualPts.length; i++) {
        const dist = Math.hypot(imgPt.x - manualPts[i].x, imgPt.y - manualPts[i].y);
        if (dist < hitThreshold) {
          hitIndex = i;
          break;
        }
      }

      if (hitIndex !== -1) {
        const updatedPoints = manualPts.filter((_, idx) => idx !== hitIndex);
        const newCenter = updatedPoints.length > 0 ? calculatePolygonCentroid(updatedPoints) : null;
        setBullet((prev) => ({
          ...prev,
          manualPoints: updatedPoints,
          center: newCenter,
          isCustomCenter: updatedPoints.length > 0,
        }));
      }
    }

    if (activeTool === ActiveTool.CurveFinder && !scoringLine.curve?.isLocked) {
      setScoringLine((prev) => ({
        ...prev,
        curve: {
          ...prev.curve!,
          points: [],
        },
      }));
    }
  };

  // Zoom with Mouse Wheel relative to pointer position
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!imageElement) return;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * factor, 0.15), 15);

    // Zoom relative to mouse cursor
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Center on cursor
    const dx = mouseX - pan.x;
    const dy = mouseY - pan.y;

    setZoom(newZoom);
    setPan({
      x: mouseX - dx * (newZoom / zoom),
      y: mouseY - dy * (newZoom / zoom),
    });
  };

  return (
    <div className="flex-1 bg-[#0F1012] flex flex-col relative h-[calc(100vh-56px)] select-none" ref={containerRef} id="vsc-workspace">
      {/* Workspace canvas element */}
      <canvas
        id="vsc-interactive-canvas"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="block cursor-grab active:cursor-grabbing w-full h-full"
      />

      {/* Floating Canvas UI Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2" id="canvas-overlay-tools">
        {/* Zoom In button */}
        <button
          onClick={() => handleZoom(1.15)}
          className="p-2.5 bg-[#151619]/95 border border-[#333] hover:border-[#F27D26] hover:bg-[#2A2B2E] text-[#E4E3E0] hover:text-white transition-all shadow-md rounded-sm cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        {/* Zoom Out button */}
        <button
          onClick={() => handleZoom(0.85)}
          className="p-2.5 bg-[#151619]/95 border border-[#333] hover:border-[#F27D26] hover:bg-[#2A2B2E] text-[#E4E3E0] hover:text-white transition-all shadow-md rounded-sm cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        {/* Zoom To Fit button */}
        <button
          onClick={handleZoomToFit}
          className="p-2.5 bg-[#151619]/95 border border-[#333] hover:border-[#F27D26] hover:bg-[#2A2B2E] text-[#E4E3E0] hover:text-white transition-all shadow-md rounded-sm cursor-pointer"
          title="Zoom to Fit Target"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* active tool instruction helper pill at bottom */}
      <div className="absolute bottom-4 left-4" id="tool-instruction-pill">
        <div className="bg-[#121315]/95 border border-[#333] text-[#E4E3E0] rounded px-3.5 py-2 flex items-center space-x-2.5 shadow-lg max-w-sm">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F27D26] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#F27D26]"></span>
          </span>
          <span className="text-[9px] font-mono tracking-wide text-[#888] uppercase">
            {activeTool === ActiveTool.None && 'STANDBY - SELECT TOOL TO ANALYZE'}
            {activeTool === ActiveTool.PanZoom && '✋ VIEWPORT: DRAG TO PAN. SCROLL TO ZOOM.'}
            {activeTool === ActiveTool.Calibrate && '📏 CALIPER: DRAG ANCHOR TABS A & B TO MATCH PRINTED RULER.'}
            {activeTool === ActiveTool.BulletROI && '🔴 DRAW BOX: CLICK & DRAG ROI BOX OVER DISPUTED SHOT.'}
            {activeTool === ActiveTool.LineROI && '🟢 DRAW BOX: CLICK & DRAG ROI BOX OVER TARGET RING EDGE.'}
            {activeTool === ActiveTool.AdjustBullet && '🎯 NUDGE: CLICK & DRAG RED CROSSHAIR TO CORRECT SHOT CENTROID.'}
            {activeTool === ActiveTool.AdjustBoundary && '⚙️ ADJUST: DRAG CENTER (C) OR OUTER RADIUS (R) TO ALIGN RING EDGE.'}
            {activeTool === ActiveTool.PlaceRefCircle && '🔍 VERIFY: DRAG 3MM BLUE CIRCLE OVER RULER TICKS TO DOUBLE-CHECK.'}
            {activeTool === ActiveTool.BulletPoints && (language === 'en' ? '🎯 BULLET POINTS: CLICK BOUNDARY TO ADD. DRAG TO NUDGE. DOUBLE-CLICK TO DELETE.' : '🎯 TÌM TÂM ĐẠN: NHẤP QUANH VIỀN ĐỂ THÊM. KÉO ĐỂ DI CHUYỂN. CLICK ĐÚP ĐỂ XÓA.')}
            {activeTool === ActiveTool.CurveFinder && (language === 'en' ? '🟢 3-POINT CURVE: CLICK START, THEN END (MIDPOINT AUTOGENS). DRAG TO BEND. DOUBLE-CLICK TO RESET.' : '🟢 ĐƯỜNG CONG 3 ĐIỂM: CLICK ĐẦU, RỒI CUỐI (TỰ TẠO ĐIỂM GIỮA). KÉO ĐỂ UỐN CONG. CLICK ĐÚP ĐỂ RESET.')}
          </span>
        </div>
      </div>
    </div>
  );
}
