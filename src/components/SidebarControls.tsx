import React, { useRef } from 'react';
import {
  Upload,
  RotateCw,
  Scale,
  Lock,
  Unlock,
  Target,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Info,
  Layers,
  Sparkles,
  HelpCircle,
  Compass,
  Activity
} from 'lucide-react';
import { ActiveTool, AppImage, CalibrationState, BulletState, ScoringLineState } from '../types';
import { presets, SamplePreset } from '../utils/canvas_generator';
import { Language, translations } from '../utils/translations';
import { calculatePolygonCentroid } from '../utils/geometry';

interface SidebarControlsProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  calibration: CalibrationState;
  setCalibration: React.Dispatch<React.SetStateAction<CalibrationState>>;
  bullet: BulletState;
  setBullet: React.Dispatch<React.SetStateAction<BulletState>>;
  scoringLine: ScoringLineState;
  setScoringLine: React.Dispatch<React.SetStateAction<ScoringLineState>>;
  currentImage: AppImage | null;
  onImageSelected: (img: AppImage) => void;
  onPresetSelected: (preset: SamplePreset) => void;
  rotation: number;
  setRotation: (rot: number) => void;
  isCvReady: boolean;
  onAutoCalibrateRuler: () => void;
  onAutoDetectBullet: () => void;
  onAutoFitScoringLine: () => void;
  language: Language;
}

export default function SidebarControls({
  activeTool,
  setActiveTool,
  calibration,
  setCalibration,
  bullet,
  setBullet,
  scoringLine,
  setScoringLine,
  currentImage,
  onImageSelected,
  onPresetSelected,
  rotation,
  setRotation,
  isCvReady,
  onAutoCalibrateRuler,
  onAutoDetectBullet,
  onAutoFitScoringLine,
  language,
}: SidebarControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        onImageSelected({
          name: file.name,
          url,
          width: img.width,
          height: img.height,
          rotation: 0,
        });
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Clear value to allow re-uploading the same file after reset
  };

  const cycleRotation = () => {
    setRotation((rotation + 90) % 360);
  };

  const nudgeCalibrationRadius = (increment: boolean) => {
    setCalibration((prev) => {
      const delta = increment ? 0.05 : -0.05;
      const newPpm = Math.max(1, prev.pixelsPerMillimeter + delta);
      return {
        ...prev,
        pixelsPerMillimeter: parseFloat(newPpm.toFixed(3)),
      };
    });
  };

  const handleSelectedRingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const score = parseInt(e.target.value);
    setScoringLine((prev) => {
      let radiusMm = 15;
      if (score === 9) radiusMm = 30;
      else if (score === 8) radiusMm = 45;
      else if (score === 7) radiusMm = 60;

      const boundaryRadMm = radiusMm - 0.4; // printed inner edge
      const boundaryRadPx = boundaryRadMm * calibration.pixelsPerMillimeter;

      return {
        ...prev,
        selectedRingScore: score,
        boundaryRadiusPixels: boundaryRadPx,
        isCustomBoundary: false,
      };
    });
  };

  return (
    <div className="bg-[#151619] border-r border-[#333] text-[#E4E3E0] w-full lg:w-80 flex flex-col h-full select-none" id="vsc-sidebar">
      {/* Current overall step indicator */}
      <div className="p-4 border-b border-[#333] space-y-1 bg-[#121315]">
        <p className="text-[10px] text-[#666] font-mono uppercase tracking-widest">{translations[language].workflowState}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono font-bold text-[#F27D26]">
            {activeTool === ActiveTool.None && translations[language].standby}
            {activeTool === ActiveTool.PanZoom && translations[language].interactiveView}
            {activeTool === ActiveTool.Calibrate && translations[language].rulerCalibration}
            {activeTool === ActiveTool.BulletROI && translations[language].drawBulletRoi}
            {activeTool === ActiveTool.AdjustBullet && translations[language].nudgeCrosshair}
            {activeTool === ActiveTool.LineROI && translations[language].drawRingRoi}
            {activeTool === ActiveTool.AdjustBoundary && translations[language].alignRingEdge}
            {activeTool === ActiveTool.CurveFinder && (language === 'en' ? '04. CURVE FINDER' : '04. TÌM ĐƯỜNG CONG')}
          </p>
          <span className="w-1.5 h-1.5 rounded-full bg-[#F27D26] animate-pulse"></span>
        </div>
      </div>

      {/* Scrollable controls list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0F1012]">
        
        {/* Step 1: Image Sourcing */}
        <div className="bg-[#151619] border border-[#333] rounded-md p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#2A2B2E]">
            <div className="flex items-center space-x-2">
              <span className="bg-[#F27D26] text-black font-mono font-bold px-1.5 py-0.5 text-[9px] rounded-sm">01</span>
              <h3 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#E4E3E0]">
                {translations[language].targetSelection}
              </h3>
            </div>
            {currentImage && (
              <span className="text-[8px] font-mono text-green-500 bg-green-950/40 border border-green-900/50 px-1.5 py-0.5 rounded uppercase font-bold">
                {translations[language].loaded}
              </span>
            )}
          </div>



          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-[#333]" />
            </div>
            <div className="relative flex justify-center text-[8px] font-mono uppercase">
              <span className="bg-[#151619] px-2 text-[#666]">{translations[language].manualSourcing}</span>
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#2A2B2E] hover:bg-[#333] border border-[#444] hover:border-[#555] text-[#E4E3E0] font-mono text-[10px] py-2 px-3 rounded uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#F27D26]" />
            <span>{translations[language].uploadDisputed}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          {currentImage && (
            <div className="flex items-center justify-between text-[9px] font-mono text-[#888] bg-[#0E0F11] p-2 rounded border border-[#2A2B2E]">
              <div className="truncate max-w-[180px]" title={currentImage.name}>
                {currentImage.name}
              </div>
              <button
                onClick={cycleRotation}
                className="p-1 hover:bg-[#2A2B2E] hover:text-[#E4E3E0] rounded transition-colors text-[#666] cursor-pointer"
                title={translations[language].rotateTooltip}
              >
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Scale Calibration */}
        <div className="bg-[#151619] border border-[#333] rounded-md p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#2A2B2E]">
            <div className="flex items-center space-x-2">
              <span className="bg-[#F27D26] text-black font-mono font-bold px-1.5 py-0.5 text-[9px] rounded-sm">02</span>
              <h3 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#E4E3E0]">
                {translations[language].rulerCalibrationTitle}
              </h3>
            </div>
            {calibration.isLocked ? (
              <span className="bg-blue-950 border border-blue-900 text-blue-400 text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold flex items-center space-x-1">
                <Lock className="w-2.5 h-2.5" />
                <span>{translations[language].lockScale.replace('🔒 ', '')}</span>
              </span>
            ) : (
              <span className="text-[8px] font-mono text-amber-500 bg-amber-950/30 border border-amber-900/40 px-1.5 py-0.5 rounded font-bold">
                {translations[language].adjusting}
              </span>
            )}
          </div>

          <p className="text-[10px] text-[#888] font-mono leading-relaxed">
            {translations[language].calibrationDesc}
          </p>

          <div className="grid grid-cols-1 gap-2">
            {!calibration.isLocked ? (
              <button
                onClick={() => {
                  setActiveTool(ActiveTool.Calibrate);
                  if (currentImage) {
                    setCalibration((prev) => ({
                      ...prev,
                      referenceCircleCenter: {
                        x: Math.round(currentImage.width / 2),
                        y: Math.round(currentImage.height / 2),
                      },
                    }));
                  }
                }}
                disabled={!currentImage}
                className={`w-full py-2.5 px-3 rounded border font-mono text-[10px] font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTool === ActiveTool.Calibrate
                    ? 'bg-amber-500 border-transparent text-black shadow-[0_0_15px_rgba(245,158,11,0.4)] font-extrabold'
                    : 'bg-amber-950/40 border-amber-600/40 hover:border-amber-500 hover:bg-amber-900/40 text-amber-300'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>{translations[language].dragCalibrationCircle}</span>
              </button>
            ) : (
              <div className="bg-[#0E0F11] border border-blue-900/30 text-[10px] font-mono text-[#888] p-2 rounded text-center">
                {translations[language].scaleLockedAt} <strong className="text-white">{calibration.pixelsPerMillimeter.toFixed(3)} px/mm</strong>
              </div>
            )}

            {/* LOCK / UNLOCK SCALE BUTTON - relocated directly below calibration circle button */}
            {currentImage && (
              <button
                onClick={() => {
                  setCalibration((prev) => {
                    const nextLocked = !prev.isLocked;
                    if (nextLocked) {
                      // Lock scale
                      setActiveTool(ActiveTool.PanZoom);
                    } else {
                      // Unlock scale -> auto-lock other tools!
                      setActiveTool(ActiveTool.Calibrate);
                      setBullet((b) => ({ ...b, isLocked: true }));
                      setScoringLine((s) => ({
                        ...s,
                        curve: s.curve ? { ...s.curve, isLocked: true } : undefined,
                      }));
                    }
                    return { ...prev, isLocked: nextLocked };
                  });
                }}
                className={`w-full font-mono text-[10px] font-bold py-2 px-4 rounded uppercase tracking-wider transition-all flex items-center justify-center space-x-2 border cursor-pointer ${
                  calibration.isLocked
                    ? 'bg-blue-950/50 hover:bg-blue-900/50 border-blue-500 text-blue-400'
                    : 'bg-amber-500 hover:bg-amber-400 text-black border-transparent shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                }`}
              >
                {calibration.isLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{translations[language].unlockScale}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>{translations[language].lockScale}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Manual Nudging for scale */}
          {!calibration.isLocked && currentImage && (
            <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-2.5 space-y-2">
              <span className="text-[9px] font-mono text-[#666] uppercase block">{translations[language].fineTuneCircleSize}</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => nudgeCalibrationRadius(false)}
                  className="bg-[#1A1B1E] border border-[#333] hover:border-[#444] hover:bg-[#202125] p-1 text-center rounded text-white flex items-center justify-center cursor-pointer font-mono text-[9px]"
                  title="Shrink calibration circle"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-amber-500 mr-1" /> {language === 'en' ? 'Size -' : 'Bán kính -'}
                </button>
                <button
                  onClick={() => nudgeCalibrationRadius(true)}
                  className="bg-[#1A1B1E] border border-[#333] hover:border-[#444] hover:bg-[#202125] p-1 text-center rounded text-white flex items-center justify-center cursor-pointer font-mono text-[9px]"
                  title="Grow calibration circle"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-amber-500 mr-1" /> {language === 'en' ? 'Size +' : 'Bán kính +'}
                </button>
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono pt-1 border-t border-[#1F2023]">
                <span className="text-[#666]">{translations[language].scaleFactor}</span>
                <span className="text-white font-bold">{calibration.pixelsPerMillimeter.toFixed(3)} px/mm</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Bullet Hole Center */}
        <div className="bg-[#151619] border border-[#333] rounded-md p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#2A2B2E]">
            <div className="flex items-center space-x-2">
              <span className="bg-[#F27D26] text-black font-mono font-bold px-1.5 py-0.5 text-[9px] rounded-sm">03</span>
              <h3 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#E4E3E0]">
                {translations[language].bulletHoleCenter}
              </h3>
            </div>
            {bullet.center ? (
              <span className="bg-green-950/40 border border-green-900/50 text-green-400 text-[8px] font-mono px-1 py-0.5 rounded uppercase font-bold">
                {translations[language].detected}
              </span>
            ) : (
              <span className="text-[8px] font-mono text-[#666] bg-[#0E0F11] border border-[#2A2B2E] px-1.5 py-0.5 rounded font-bold">
                {translations[language].awaiting}
              </span>
            )}
          </div>

          <p className="text-[10px] text-[#888] font-mono leading-relaxed">
            {translations[language].bulletDesc}
          </p>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => {
                if (activeTool === ActiveTool.BulletPoints) {
                  setActiveTool(ActiveTool.PanZoom);
                } else {
                  setActiveTool(ActiveTool.BulletPoints);
                  if (!bullet.manualPoints) {
                    setBullet(prev => ({ ...prev, manualPoints: [] }));
                  }
                }
              }}
              disabled={!calibration.isLocked || bullet.isLocked}
              className={`w-full text-center text-[10px] py-2.5 px-3 rounded font-mono border transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                activeTool === ActiveTool.BulletPoints
                  ? 'bg-red-500 border-transparent text-black shadow-[0_0_15px_rgba(239,68,68,0.4)] font-extrabold'
                  : 'bg-red-950/40 border-red-600/40 hover:border-red-500 hover:bg-red-900/40 text-red-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300" />
              <span className="uppercase">{translations[language].findBulletCenter}</span>
            </button>

            {/* LOCK / UNLOCK BULLET CENTER BUTTON - relocated directly below finding button */}
            {currentImage && (
              <button
                onClick={() => {
                  setBullet((prev) => {
                    const nextLocked = !prev.isLocked;
                    if (nextLocked) {
                      setActiveTool(ActiveTool.PanZoom);
                    } else {
                      // Unlock bullet -> auto-lock other tools!
                      setActiveTool(ActiveTool.BulletPoints);
                      setCalibration((c) => ({ ...c, isLocked: true }));
                      setScoringLine((s) => ({
                        ...s,
                        curve: s.curve ? { ...s.curve, isLocked: true } : undefined,
                      }));
                    }
                    return { ...prev, isLocked: nextLocked };
                  });
                }}
                className={`w-full font-mono text-[10px] font-bold py-2 px-4 rounded uppercase tracking-wider transition-all flex items-center justify-center space-x-2 border cursor-pointer ${
                  bullet.isLocked
                    ? 'bg-red-950/50 hover:bg-red-900/50 border-red-500 text-red-400'
                    : 'bg-red-500 hover:bg-red-400 text-black border-transparent shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                }`}
              >
                {bullet.isLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{translations[language].unlockBullet}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>{translations[language].lockBullet}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {bullet.manualPoints && bullet.manualPoints.length > 0 && (
            <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#F27D26]">
                  {translations[language].activePoints}: {bullet.manualPoints.length}
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => {
                      setBullet((prev) => ({
                        ...prev,
                        hidePoints: !prev.hidePoints,
                      }));
                    }}
                    className={`text-[8px] font-mono transition-all cursor-pointer border px-1.5 py-0.5 rounded font-bold uppercase ${
                      bullet.hidePoints
                        ? 'bg-blue-950/40 border-blue-800/60 text-blue-300 hover:bg-blue-900/40'
                        : 'bg-[#1A1B1E] border-[#333] text-[#888] hover:border-[#444] hover:bg-[#202125]'
                    }`}
                  >
                    {bullet.hidePoints ? translations[language].showPoints : translations[language].hidePoints}
                  </button>
                  <button
                    onClick={() => {
                      if (bullet.isLocked) return;
                      setBullet((prev) => ({
                        ...prev,
                        manualPoints: [],
                        center: null,
                        isCustomCenter: false,
                      }));
                    }}
                    disabled={bullet.isLocked}
                    className="text-[8px] font-mono text-red-400 hover:text-red-300 transition-all cursor-pointer bg-red-950/25 border border-red-900/40 px-1.5 py-0.5 rounded font-bold uppercase disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    {translations[language].clearPoints}
                  </button>
                </div>
              </div>

              <div className="text-[9px] text-[#888] font-mono leading-relaxed bg-[#16171B] p-2 border border-[#222] rounded max-h-[140px] overflow-y-auto custom-scrollbar">
                <div className="text-[8px] text-[#555] mb-1.5 uppercase tracking-wider border-b border-[#2A2B2E]/60 pb-1 font-bold">
                  {translations[language].bulletPointsInstructions}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  {bullet.manualPoints.map((pt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#111215] border border-[#222] p-1 rounded hover:border-[#333] group text-[8px]"
                    >
                      <span className="flex items-center space-x-1">
                        <span className="inline-block w-3.5 h-3.5 bg-[#F27D26] text-black rounded-full font-bold font-mono text-[8px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-[#888]">
                          {Math.round(pt.x)}, {Math.round(pt.y)}
                        </span>
                      </span>
                      <button
                        onClick={() => {
                          if (bullet.isLocked) return;
                          const updated = (bullet.manualPoints || []).filter((_, i) => i !== idx);
                          const newCenter = updated.length > 0 ? calculatePolygonCentroid(updated) : null;
                          setBullet((prev) => ({
                            ...prev,
                            manualPoints: updated,
                            center: newCenter,
                            isCustomCenter: updated.length > 0,
                          }));
                        }}
                        disabled={bullet.isLocked}
                        className="text-red-500 hover:text-red-400 font-bold transition-all px-1 text-[8px] disabled:opacity-35"
                        title="Delete point"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {bullet.center && calibration.isLocked && (
            <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-2.5 space-y-2">
              <button
                onClick={() => setActiveTool(ActiveTool.AdjustBullet)}
                disabled={bullet.isLocked}
                className={`w-full text-center text-[9px] py-1 px-2 rounded font-mono border transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTool === ActiveTool.AdjustBullet
                    ? 'bg-[#2A2B2E] border-[#F27D26] text-[#F27D26]'
                    : 'bg-[#1A1B1E] hover:bg-[#202125] border-[#333] text-[#888]'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-red-500" />
                <span>{translations[language].nudgeCrosshairBtn}</span>
              </button>
              <div className="text-[8px] font-mono text-[#666] text-center">
                {translations[language].nudgeCrosshairDesc}
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Scoring Line */}
        <div className="bg-[#151619] border border-[#333] rounded-md p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#2A2B2E]">
            <div className="flex items-center space-x-2">
              <span className="bg-[#F27D26] text-black font-mono font-bold px-1.5 py-0.5 text-[9px] rounded-sm">04</span>
              <h3 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#E4E3E0]">
                {translations[language].scoringBoundary}
              </h3>
            </div>
            {scoringLine.curve && scoringLine.curve.points.length >= 3 ? (
              <span className="bg-green-950/40 border border-green-900/50 text-green-400 text-[8px] font-mono px-1 py-0.5 rounded uppercase font-bold">
                {translations[language].aligned}
              </span>
            ) : (
              <span className="text-[8px] font-mono text-[#666] bg-[#0E0F11] border border-[#2A2B2E] px-1.5 py-0.5 rounded font-bold">
                {translations[language].pending}
              </span>
            )}
          </div>

          <p className="text-[10px] text-[#888] font-mono leading-relaxed">
            {translations[language].scoringBoundaryDesc}
          </p>

          {/* Curve Finder Tool Section */}
          <div className="bg-[#0E0F11] border border-[#2A2B2E] rounded p-3 space-y-3">
            <button
              onClick={() => setActiveTool(ActiveTool.CurveFinder)}
              disabled={!calibration.isLocked || !!scoringLine.curve?.isLocked}
              className={`w-full py-2.5 px-3 rounded border font-mono text-[10px] font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                activeTool === ActiveTool.CurveFinder
                  ? 'bg-green-500 border-transparent text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] font-extrabold'
                  : 'bg-green-950/40 border-green-600/40 hover:border-green-500 hover:bg-green-900/40 text-green-300'
              }`}
            >
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{translations[language].curveFinderTool.toUpperCase()}</span>
            </button>

            {/* LOCK / UNLOCK CURVE BUTTON - relocated directly below curve finder button */}
            {currentImage && (
              <button
                onClick={() => {
                  setScoringLine((prev) => {
                    const nextLocked = !prev.curve?.isLocked;
                    if (nextLocked) {
                      setActiveTool(ActiveTool.PanZoom);
                    } else {
                      // Unlock curve -> auto-lock other tools!
                      setActiveTool(ActiveTool.CurveFinder);
                      setCalibration((c) => ({ ...c, isLocked: true }));
                      setBullet((b) => ({ ...b, isLocked: true }));
                    }
                    return {
                      ...prev,
                      curve: prev.curve ? {
                        ...prev.curve,
                        isLocked: nextLocked,
                      } : {
                        points: [],
                        isLocked: nextLocked,
                      },
                    };
                  });
                }}
                className={`w-full font-mono text-[10px] font-bold py-2 px-4 rounded uppercase tracking-wider transition-all flex items-center justify-center space-x-2 border cursor-pointer ${
                  scoringLine.curve?.isLocked
                    ? 'bg-green-950/50 hover:bg-green-900/50 border-green-500 text-green-400'
                    : 'bg-green-500 hover:bg-green-400 text-black border-transparent shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                }`}
              >
                {scoringLine.curve?.isLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{translations[language].unlockCurve}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>{translations[language].lockCurve}</span>
                  </>
                )}
              </button>
            )}

          {/* Display Curve Controls if Active or Curve has points */}
          {((scoringLine.curve?.points.length || 0) > 0 || activeTool === ActiveTool.CurveFinder) && (
            <div className="space-y-2.5 pt-1.5 border-t border-[#2A2B2E]">
              {/* Instructions */}
              <p className="text-[8px] text-[#888] font-mono leading-relaxed">
                {translations[language].curveInstructions}
              </p>

              {/* Points Count */}
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-[#666] uppercase">{translations[language].curvePoints}:</span>
                <span className="text-[#E4E3E0] font-bold bg-[#1A1B1E] px-1.5 py-0.5 rounded border border-[#333]">
                  {scoringLine.curve?.points.length || 0}
                </span>
              </div>

              {/* Clear Controls Button */}
              <button
                onClick={() => {
                  setScoringLine((prev) => ({
                    ...prev,
                    curve: {
                      ...prev.curve!,
                      points: [],
                      isLocked: false,
                    },
                  }));
                }}
                className="w-full text-[9px] py-1.5 px-2 rounded font-mono border border-red-500/30 hover:bg-red-950/20 hover:border-red-500/50 text-red-400 font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>{translations[language].clearCurvePoints}</span>
              </button>

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] font-mono text-[#666] uppercase">{language === 'en' ? 'Visibility:' : 'Hiển thị:'}</span>
                  <button
                    onClick={() => {
                      setScoringLine((prev) => ({
                        ...prev,
                        curve: {
                          ...prev.curve!,
                          isHidden: !prev.curve?.isHidden,
                        },
                      }));
                    }}
                    className="text-[9px] px-2 py-1 rounded bg-[#1A1B1E] border border-[#333] hover:border-[#444] text-[#888] font-mono cursor-pointer"
                  >
                    {scoringLine.curve?.isHidden ? translations[language].showCurve : translations[language].hideCurve}
                  </button>
                </div>

                {/* Curve Thickness & Color Selector */}
                <div className="space-y-2 pt-1.5 border-t border-[#2A2B2E]/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[#666]">{translations[language].curveColor}</span>
                    <div className="flex items-center space-x-1">
                      {['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899'].map((c) => (
                        <button
                           key={c}
                           onClick={() => {
                             setScoringLine((prev) => ({
                               ...prev,
                               curve: {
                                 ...prev.curve!,
                                 color: c,
                               },
                             }));
                           }}
                           style={{ backgroundColor: c }}
                           className={`w-3.5 h-3.5 rounded-full border-2 transition-all cursor-pointer ${
                             scoringLine.curve?.color === c ? 'border-[#E4E3E0] scale-110' : 'border-[#151619] opacity-70 hover:opacity-100'
                           }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[#666]">{translations[language].curveThickness}</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={scoringLine.curve?.thickness || 3}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setScoringLine((prev) => ({
                            ...prev,
                            curve: {
                              ...prev.curve!,
                              thickness: val,
                            },
                          }));
                        }}
                        className="w-20 h-1 bg-[#1A1B1E] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                      />
                      <span className="text-[9px] font-mono text-[#888] w-4 text-right">{(scoringLine.curve?.thickness || 3)}px</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Navigation mode buttons */}
      <div className="p-4 border-t border-[#333] bg-[#0E0F11] flex items-center justify-between">
        <button
          onClick={() => setActiveTool(ActiveTool.PanZoom)}
          className={`flex-1 text-center text-[10px] font-mono font-bold py-2.5 px-3 rounded border transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            activeTool === ActiveTool.PanZoom
              ? 'bg-[#2A2B2E] border-[#F27D26] text-[#F27D26] shadow-inner'
              : 'bg-[#151619] border-[#333] text-[#888] hover:text-[#E4E3E0] hover:border-[#444]'
          }`}
        >
          <span>{translations[language].dragPanZoom}</span>
        </button>
      </div>
    </div>
  );
}

// Simple icon replacement helper to prevent importing too many libraries
function MoveHorizontal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m18 8 4 4-4 4" />
      <path d="M2 12h20" />
      <path d="m6 8-4 4 4 4" />
    </svg>
  );
}

function Sliders(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </svg>
  );
}
