import { CheckCircle2, XCircle, Scale, Compass, ChevronRight, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { CalibrationState, BulletState, ScoringLineState } from '../types';
import { Language, translations } from '../utils/translations';
import { getOpenSplinePoints, getMinimumDistanceToSpline, isPointInPolygon, calculatePolygonCentroid } from '../utils/geometry';

interface ResultPanelProps {
  calibration: CalibrationState;
  bullet: BulletState;
  scoringLine: ScoringLineState;
  onReset: () => void;
  language: Language;
}

export default function ResultPanel({
  calibration,
  bullet,
  scoringLine,
  onReset,
  language,
}: ResultPanelProps) {
  const isCalibrated = calibration.isValid && calibration.pixelsPerMillimeter > 0 && calibration.isLocked;
  const hasBullet = bullet.center !== null;
  const hasBoundary = scoringLine.boundaryRadiusPixels > 0;
  const isCurveActive = !!(scoringLine.curve && scoringLine.curve.points.length >= 3);

  // Perform VSC VAR Math
  let result: 'HIGHER SCORE' | 'LOWER SCORE' | 'PENDING' = 'PENDING';
  let distancePx = 0;
  let distanceMm = 0;
  let boundaryMm = 0;
  let varRadiusPx = 0;
  let varRadiusMm = 1.5; // 3mm diameter standard VAR circle -> 1.5mm radius
  let deltaPx = 0;
  let deltaMm = 0;
  let isInside = false;

  if (isCalibrated && hasBullet) {
    varRadiusPx = varRadiusMm * calibration.pixelsPerMillimeter;

    if (isCurveActive) {
      const splinePoints = getOpenSplinePoints(scoringLine.curve!.points);
      // Distance from bullet center to the curve
      distancePx = getMinimumDistanceToSpline(bullet.center!, splinePoints);
      distanceMm = distancePx / calibration.pixelsPerMillimeter;

      // Find the closest point on the spline to the bullet center to determine inside/outside
      let closestSplinePt = splinePoints[0];
      let minD = Math.hypot(bullet.center!.x - splinePoints[0].x, bullet.center!.y - splinePoints[0].y);
      for (const sPt of splinePoints) {
        const d = Math.hypot(bullet.center!.x - sPt.x, bullet.center!.y - sPt.y);
        if (d < minD) {
          minD = d;
          closestSplinePt = sPt;
        }
      }

      // Compare distance of bullet center to target center (scoringLine.center)
      // and distance of closestSplinePt to target center
      const bulletDistToCenter = Math.hypot(bullet.center!.x - scoringLine.center.x, bullet.center!.y - scoringLine.center.y);
      const curveDistToCenter = Math.hypot(closestSplinePt.x - scoringLine.center.x, closestSplinePt.y - scoringLine.center.y);

      isInside = bulletDistToCenter <= curveDistToCenter;

      if (isInside) {
        result = 'HIGHER SCORE';
        // Overlap delta: since center is inside, overlap is varRadius + distance to boundary
        deltaPx = varRadiusPx + distancePx;
      } else {
        // Outside
        if (distancePx <= varRadiusPx) {
          result = 'HIGHER SCORE';
        } else {
          result = 'LOWER SCORE';
        }
        deltaPx = varRadiusPx - distancePx;
      }
      deltaMm = deltaPx / calibration.pixelsPerMillimeter;
    } else {
      boundaryMm = scoringLine.boundaryRadiusPixels / calibration.pixelsPerMillimeter;

      const bx = bullet.center!.x;
      const by = bullet.center!.y;
      const rx = scoringLine.center.x;
      const ry = scoringLine.center.y;

      // Calculate distance between bullet center and ring center
      distancePx = Math.sqrt((bx - rx) * (bx - rx) + (by - ry) * (by - ry));
      distanceMm = distancePx / calibration.pixelsPerMillimeter;

      // Boundary check
      // If distance is less than or equal to (boundary + varRadius), the circle intersects/touches
      const thresholdPx = scoringLine.boundaryRadiusPixels + varRadiusPx;
      deltaPx = thresholdPx - distancePx;
      deltaMm = deltaPx / calibration.pixelsPerMillimeter;

      if (distancePx <= thresholdPx) {
        result = 'HIGHER SCORE';
      } else {
        result = 'LOWER SCORE';
      }
    }
  }

  const scoreLvl = scoringLine.selectedRingScore;
  const higherScore = scoreLvl;
  const lowerScore = scoreLvl - 1;

  const handleExportReport = () => {
    const srcCanvas = document.getElementById('vsc-interactive-canvas') as HTMLCanvasElement;
    if (!srcCanvas) {
      console.error(translations[language].exportError);
      return;
    }

    // Determine sizes relative to the DPR of the source canvas so it's perfectly crisp!
    const dpr = srcCanvas.width / srcCanvas.clientWidth;
    const sidebarWidth = Math.round(350 * dpr);
    const destCanvas = document.createElement('canvas');
    destCanvas.width = srcCanvas.width + sidebarWidth;
    destCanvas.height = srcCanvas.height;

    const ctx = destCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Fill entire canvas background with #0F1012
    ctx.fillStyle = '#0F1012';
    ctx.fillRect(0, 0, destCanvas.width, destCanvas.height);

    // 2. Draw live zoomed-and-panned interactive canvas snapshot on the left
    ctx.drawImage(srcCanvas, 0, 0);

    // 3. Draw sidebar container background
    const panelX = srcCanvas.width;
    ctx.fillStyle = '#151619';
    ctx.fillRect(panelX, 0, sidebarWidth, destCanvas.height);

    // Draw vertical divider
    ctx.strokeStyle = '#2A2B2E';
    ctx.lineWidth = Math.round(3 * dpr);
    ctx.beginPath();
    ctx.moveTo(panelX, 0);
    ctx.lineTo(panelX, destCanvas.height);
    ctx.stroke();

    // 4. Draw Header
    const pad = Math.round(20 * dpr);
    let currY = pad;

    ctx.fillStyle = '#F27D26';
    ctx.font = `bold ${Math.round(11 * dpr)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('VIETNAM SLINGSHOT CHAMPIONSHIP', panelX + pad, currY);

    currY += Math.round(18 * dpr);
    ctx.fillStyle = '#E4E3E0';
    ctx.font = `bold ${Math.round(10 * dpr)}px monospace`;
    ctx.fillText('OFFICIAL VAR SCORING REPORT', panelX + pad, currY);

    currY += Math.round(24 * dpr);

    // Divider line
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = Math.round(1 * dpr);
    ctx.beginPath();
    ctx.moveTo(panelX + pad, currY);
    ctx.lineTo(panelX + sidebarWidth - pad, currY);
    ctx.stroke();

    currY += Math.round(15 * dpr);

    // 5. Draw Verdict banner
    const bannerH = Math.round(60 * dpr);
    ctx.fillStyle = result === 'HIGHER SCORE' ? '#122E1A' : '#301519';
    ctx.strokeStyle = result === 'HIGHER SCORE' ? '#10b981' : '#ef4444';
    ctx.lineWidth = Math.round(2 * dpr);
    
    ctx.beginPath();
    ctx.rect(panelX + pad, currY, sidebarWidth - pad * 2, bannerH);
    ctx.fill();
    ctx.stroke();

    // Text in banner
    ctx.fillStyle = result === 'HIGHER SCORE' ? '#34d399' : '#f87171';
    ctx.font = `bold ${Math.round(14 * dpr)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      result === 'HIGHER SCORE' ? translations[language].resolvedHigher : translations[language].resolvedLower,
      panelX + sidebarWidth / 2,
      currY + Math.round(20 * dpr)
    );

    ctx.fillStyle = '#E4E3E0';
    ctx.font = `bold ${Math.round(8 * dpr)}px monospace`;
    ctx.fillText(
      result === 'HIGHER SCORE'
        ? `TOUCH DETECTED: +${higherScore} PTS`
        : `NO TOUCH: +${lowerScore} PTS`,
      panelX + sidebarWidth / 2,
      currY + Math.round(42 * dpr)
    );

    ctx.textAlign = 'left'; // Reset alignment
    ctx.textBaseline = 'top';
    currY += bannerH + Math.round(20 * dpr);

    // 6. Draw Telemetry Details
    const drawSection = (title: string, pairs: { label: string; val: string }[]) => {
      ctx.fillStyle = '#888888';
      ctx.font = `bold ${Math.round(8 * dpr)}px monospace`;
      ctx.fillText(title.toUpperCase(), panelX + pad, currY);
      currY += Math.round(14 * dpr);

      // Section box container
      const boxH = pairs.length * Math.round(15 * dpr) + Math.round(10 * dpr);
      ctx.fillStyle = '#0E0F11';
      ctx.strokeStyle = '#2A2B2E';
      ctx.lineWidth = Math.round(1 * dpr);
      ctx.beginPath();
      ctx.rect(panelX + pad, currY, sidebarWidth - pad * 2, boxH);
      ctx.fill();
      ctx.stroke();

      let textY = currY + Math.round(5 * dpr);
      pairs.forEach((p) => {
        ctx.fillStyle = '#666666';
        ctx.font = `${Math.round(8 * dpr)}px monospace`;
        ctx.fillText(p.label, panelX + pad + Math.round(8 * dpr), textY);

        ctx.fillStyle = '#E4E3E0';
        ctx.font = `bold ${Math.round(8 * dpr)}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(p.val, panelX + sidebarWidth - pad - Math.round(8 * dpr), textY);
        ctx.textAlign = 'left';
        textY += Math.round(15 * dpr);
      });

      currY += boxH + Math.round(15 * dpr);
    };

    // Section 1: Calibration
    drawSection(translations[language].scaleMatrix, [
      { label: 'PIXELS_PER_MM:', val: `${calibration.pixelsPerMillimeter.toFixed(3)} px` },
      { label: 'VAR_DIAMETER (3.0mm):', val: `${(calibration.pixelsPerMillimeter * 3).toFixed(1)} px` }
    ]);

    // Section 2: Coordinates
    const bulletX = bullet.center ? bullet.center.x.toFixed(1) : '0';
    const bulletY = bullet.center ? bullet.center.y.toFixed(1) : '0';
    const ringX = isCurveActive && scoringLine.curve ? calculatePolygonCentroid(scoringLine.curve.points).x.toFixed(1) : scoringLine.center.x.toFixed(1);
    const ringY = isCurveActive && scoringLine.curve ? calculatePolygonCentroid(scoringLine.curve.points).y.toFixed(1) : scoringLine.center.y.toFixed(1);

    drawSection(translations[language].coordinatesTitle, [
      { label: 'BULLET_CTR:', val: `[X:${bulletX}, Y:${bulletY}]` },
      { label: 'RING_CTR:', val: `[X:${ringX}, Y:${ringY}]` },
      { label: 'TRACKING_MODE:', val: bullet.isCustomCenter ? 'JUDGE_NUDGE' : 'CV_CONVEX_HULL' }
    ]);

    // Section 3: Disputed Ring
    drawSection(`${translations[language].disputedBoundaryTitle} (${scoreLvl}-Ring)`, [
      { label: 'OUTER_RADIUS:', val: isCurveActive ? 'SPLINE_CURVE' : `${boundaryMm.toFixed(3)} mm` },
      { label: 'SHOT_DISTANCE:', val: `${distanceMm.toFixed(3)} mm` },
      { label: 'VAR_CLEARANCE / DELTA:', val: `${deltaMm.toFixed(3)} mm` },
      { label: 'ALIGNMENT_METHOD:', val: isCurveActive ? 'MANUAL_CURVE' : scoringLine.isCustomBoundary ? 'MANUAL_FIT' : 'CV_SOBEL_RIDGE' }
    ]);

    // 7. Draw Footer Official Stamp / Date
    const timestamp = new Date().toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    ctx.fillStyle = '#444444';
    ctx.font = `${Math.round(8 * dpr)}px monospace`;
    ctx.fillText(`DATE/TIME: ${timestamp}`, panelX + pad, destCanvas.height - Math.round(35 * dpr));
    ctx.fillText('VERDICT: OFFICIALLY GENERATED BY VSC VAR SCORING ENGINE', panelX + pad, destCanvas.height - Math.round(20 * dpr));

    // Trigger download
    const link = document.createElement('a');
    link.download = `VSC_VAR_REPORT_${result}_${timestamp.replace(/[:\/ ]/g, '_')}.png`;
    link.href = destCanvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="bg-[#151619] border border-[#333] rounded-md p-4 shadow-lg flex flex-col justify-between h-full select-none" id="vsc-result-panel">
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#333]">
          <h2 className="text-[10px] font-mono font-bold tracking-widest text-[#666] uppercase">
            {translations[language].varEvaluationEngine}
          </h2>
          <button
            onClick={onReset}
            className="text-[9px] text-[#888] hover:text-[#E4E3E0] transition-colors flex items-center space-x-1 font-mono hover:bg-[#2A2B2E] px-2 py-1 rounded border border-[#333] cursor-pointer"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>{translations[language].resetBtn}</span>
          </button>
        </div>

        {/* Dynamic score verdict */}
        {result === 'PENDING' ? (
          <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-5 text-center text-[#888] font-mono text-xs mb-4">
            <AlertTriangle className="w-6 h-6 mx-auto text-[#F27D26] mb-2 animate-pulse" />
            <p className="font-bold text-[#E4E3E0] uppercase tracking-wider">{translations[language].awaitingInputs}</p>
            <p className="text-[9px] text-[#666] mt-2 leading-relaxed">
              {!calibration.isLocked ? (
                <span>{translations[language].scaleCalibrationActiveDesc}</span>
              ) : !bullet.center ? (
                <span>{translations[language].bulletHoleActiveDesc}</span>
              ) : (
                <span>{translations[language].targetRingActiveDesc}</span>
              )}
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex flex-col items-center">
              <div className="bg-[#F27D26] text-black font-mono font-bold px-3 py-0.5 text-[9px] tracking-wider uppercase rounded-t-sm w-full text-center">
                {translations[language].geometricVerdict}
              </div>
              <div
                className={`w-full p-4 border-x border-b text-center rounded-b-sm ${
                  result === 'HIGHER SCORE'
                    ? 'bg-[#121E16] border-green-500/40 text-green-400'
                    : 'bg-[#201214] border-red-500/40 text-red-400'
                }`}
              >
                <h3 className="text-xl font-mono font-black tracking-tighter uppercase leading-none mb-1">
                  {result === 'HIGHER SCORE' ? translations[language].resolvedHigher : translations[language].resolvedLower}
                </h3>
                <p className="text-[9px] font-mono uppercase tracking-wide opacity-80 mt-1.5 text-[#E4E3E0]">
                  {result === 'HIGHER SCORE'
                    ? `${translations[language].overlapSuccess}: +${higherScore} ${language === 'en' ? 'Points' : 'Điểm'}`
                    : `${translations[language].overlapFail}: +${lowerScore} ${language === 'en' ? 'Points' : 'Điểm'}`}
                </p>
              </div>
            </div>

            {/* Micro mathematical proof explanation */}
            <p className="text-[9px] text-[#666] font-mono mt-2 leading-relaxed text-center px-1">
              {isCurveActive ? (
                result === 'HIGHER SCORE' ? (
                  isInside ? (
                    <span>
                      [PASS] {translations[language].proofInside}. {translations[language].proofOverlap}:{' '}
                      <span className="text-green-400 font-bold">+{deltaMm.toFixed(3)}mm</span>.
                    </span>
                  ) : (
                    <span>
                      [PASS] {translations[language].proofDistance} ({distanceMm.toFixed(3)}mm) &le; VAR Rad (1.500mm). {translations[language].proofOverlap}:{' '}
                      <span className="text-green-400 font-bold">+{deltaMm.toFixed(3)}mm</span>.
                    </span>
                  )
                ) : (
                  <span>
                    [FAIL] {translations[language].proofDistance} ({distanceMm.toFixed(3)}mm) &gt; VAR Rad (1.500mm). {translations[language].proofDelta}:{' '}
                    <span className="text-red-400 font-bold">{deltaMm.toFixed(3)}mm</span>.
                  </span>
                )
              ) : result === 'HIGHER SCORE' ? (
                <span>
                  [PASS] {translations[language].proofDistance} ({distanceMm.toFixed(3)}mm) &le; {translations[language].proofBoundary} ({boundaryMm.toFixed(3)}mm) + VAR Rad (1.500mm). {translations[language].proofOverlap}:{' '}
                  <span className="text-green-400 font-bold">+{deltaMm.toFixed(3)}mm</span>.
                </span>
              ) : (
                <span>
                  [FAIL] {translations[language].proofDistance} ({distanceMm.toFixed(3)}mm) &gt; {translations[language].proofBoundary} ({boundaryMm.toFixed(3)}mm) + VAR Rad (1.500mm). {translations[language].proofDelta}:{' '}
                  <span className="text-red-400 font-bold">{deltaMm.toFixed(3)}mm</span>.
                </span>
              )}
            </p>
            
            <button
              onClick={handleExportReport}
              className="mt-4 w-full bg-[#2A2B2E] hover:bg-[#333] active:bg-[#202124] border border-[#444] hover:border-[#F27D26] text-[#E4E3E0] hover:text-white font-mono text-[10px] font-bold py-2.5 px-3 rounded uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg"
            >
              <Download className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>{translations[language].exportImage}</span>
            </button>
          </div>
        )}

        {/* Telemetry Indicators */}
        <div className="space-y-3" id="vsc-telemetry">
          <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-3">
            <h4 className="text-[9px] font-mono font-bold text-[#888] mb-1.5 flex items-center space-x-1.5 uppercase">
              <Scale className="w-3 h-3 text-blue-400" />
              <span>{translations[language].scaleMatrix}</span>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="text-[#666]">PIXELS_PER_MM:</div>
              <div className="text-[#E4E3E0] text-right">
                {isCalibrated ? `${calibration.pixelsPerMillimeter.toFixed(3)} px` : '--'}
              </div>
              <div className="text-[#666]">VAR_DIA (3.0mm):</div>
              <div className="text-[#E4E3E0] text-right">
                {isCalibrated ? `${(calibration.pixelsPerMillimeter * 3).toFixed(1)} px` : '--'}
              </div>
            </div>
          </div>

          <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-3">
            <h4 className="text-[9px] font-mono font-bold text-[#888] mb-1.5 flex items-center space-x-1.5 uppercase">
              <Compass className="w-3 h-3 text-[#F27D26]" />
              <span>{translations[language].coordinatesTitle}</span>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="text-[#666]">BULLET_CTR:</div>
              <div className="text-[#E4E3E0] text-right truncate">
                {hasBullet ? `[X:${bullet.center!.x.toFixed(1)}, Y:${bullet.center!.y.toFixed(1)}]` : 'PENDING'}
              </div>
              <div className="text-[#666]">RING_CTR:</div>
              <div className="text-[#E4E3E0] text-right">
                {isCurveActive && scoringLine.curve ? (
                  `[X:${calculatePolygonCentroid(scoringLine.curve.points).x.toFixed(1)}, Y:${calculatePolygonCentroid(scoringLine.curve.points).y.toFixed(1)}]`
                ) : (
                  `[X:${scoringLine.center.x.toFixed(1)}, Y:${scoringLine.center.y.toFixed(1)}]`
                )}
              </div>
              <div className="text-[#666]">TRACKING:</div>
              <div className="text-right text-green-500 font-bold">
                {bullet.isCustomCenter ? 'JUDGE_NUDGE' : 'CV_CONVEX_HULL'}
              </div>
            </div>
          </div>

          <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-3">
            <h4 className="text-[9px] font-mono font-bold text-[#888] mb-1.5 flex items-center space-x-1.5 uppercase">
              <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{translations[language].disputedBoundaryTitle} ({scoreLvl}-{language === 'en' ? 'Ring' : 'Vòng'})</span>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="text-[#666]">INNER_RAD:</div>
              <div className="text-[#E4E3E0] text-right">
                {isCurveActive ? (language === 'en' ? 'SPLINE' : 'ĐƯỜNG CONG') : isCalibrated ? `${boundaryMm.toFixed(3)} mm` : '--'}
              </div>
              <div className="text-[#666]">ACTUAL_DIST:</div>
              <div className="text-[#E4E3E0] text-right">
                {hasBullet && isCalibrated ? `${distanceMm.toFixed(3)} mm` : '--'}
              </div>
              <div className="text-[#666]">ALIGNMENT:</div>
              <div className="text-right text-green-500 font-bold">
                {isCurveActive ? (language === 'en' ? 'MANUAL_CURVE' : 'KHỚP ĐƯỜNG CONG') : scoringLine.isCustomBoundary ? 'MANUAL_FIT' : 'CV_SOBEL_RIDGE'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-[#333] pt-3 text-[8px] font-mono text-[#555] leading-normal uppercase tracking-wider space-y-1">
        <p className="flex items-center space-x-1.5">
          <span className="w-1 h-1 rounded-full bg-blue-500" />
          <span>{translations[language].clause14}</span>
        </p>
        <p className="flex items-center space-x-1.5">
          <span className="w-1 h-1 rounded-full bg-green-500" />
          <span>{translations[language].innerEdgeBoundary}</span>
        </p>
      </div>
    </div>
  );
}
