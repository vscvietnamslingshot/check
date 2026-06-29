import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import SidebarControls from './components/SidebarControls';
import WorkspaceCanvas from './components/WorkspaceCanvas';
import ResultPanel from './components/ResultPanel';
import { ActiveTool, AppImage, CalibrationState, BulletState, ScoringLineState } from './types';
import { loadOpenCV, detectBulletCenterPureJS, autoCalibrateRulerPureJS, fitScoringLinePureJS } from './image_processing/cv_engine';
import { SamplePreset, presets, generateTargetImage } from './utils/canvas_generator';
import { HelpCircle, Info, Target, X } from 'lucide-react';
import { Language, translations } from './utils/translations';

const modalTranslations = {
  vi: {
    modalTitle: "XEM TRƯỚC BIA MẪU VSC CHÍNH THỨC",
    expectedResult: "KẾT QUẢ DỰ KIẾN",
    reasoning: "LÝ DO PHÂN TÍCH",
    standardScale: "TỶ LỆ CHUẨN",
    closeBtn: "ĐÓNG CỬA SỔ",
  },
  en: {
    modalTitle: "OFFICIAL VSC SAMPLE TARGET PREVIEW",
    expectedResult: "EXPECTED RESULT",
    reasoning: "ANALYSIS REASON",
    standardScale: "STANDARD SCALE",
    closeBtn: "CLOSE PREVIEW",
  }
};

const initialCalibration: CalibrationState = {
  pixelsPerMillimeter: 25.0, // default starting scale (25.0 px/mm - larger and clearer)
  caliperA: { x: 150, y: 680 },
  caliperB: { x: 235, y: 680 }, 
  spanMm: 10,
  isValid: true, // Always valid/available for Workflow 2.0
  referenceCircleCenter: { x: 400, y: 550 },
  isLocked: false,
};

const initialBullet: BulletState = {
  center: null,
  detectedCenter: null,
  roi: null,
  contour: [],
  convexHull: [],
  holeRadiusPixels: 10,
  isCustomCenter: false,
  manualPoints: [],
  isLocked: false,
  hidePoints: false,
};

const initialScoringLine: ScoringLineState = {
  center: { x: 400, y: 360 },
  selectedRingScore: 10,
  boundaryRadiusPixels: 0,
  isCustomBoundary: false,
  roi: null,
  curve: {
    points: [],
    isLocked: false,
    isHidden: false,
    color: '#10b981',
    thickness: 3,
  },
};

export default function App() {
  const [language, setLanguage] = useState<Language>('vi');
  const [isCvReady, setIsCvReady] = useState<boolean>(false);
  const [currentImage, setCurrentImage] = useState<AppImage | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>(ActiveTool.PanZoom);
  const [rotation, setRotation] = useState<number>(0);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [activePresetForPreview, setActivePresetForPreview] = useState<SamplePreset | null>(null);

  // Calibration, Bullet, and Scoring States
  const [calibration, setCalibration] = useState<CalibrationState>(initialCalibration);
  const [bullet, setBullet] = useState<BulletState>(initialBullet);
  const [scoringLine, setScoringLine] = useState<ScoringLineState>(initialScoringLine);

  const exportReportRef = useRef<(() => void) | null>(null);

  // Mobile View Tab state ('canvas' | 'controls' | 'results')
  const [mobileView, setMobileView] = useState<'canvas' | 'controls' | 'results'>('canvas');

  // Auto switch mobile tab to Canvas when an interactive tool is selected
  useEffect(() => {
    if (activeTool !== ActiveTool.None && activeTool !== ActiveTool.PanZoom) {
      setMobileView('canvas');
    }
  }, [activeTool]);

  // Toast/Feedback state for process info
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Trigger loading OpenCV
  useEffect(() => {
    loadOpenCV(() => {
      setIsCvReady(true);
      // Wait a moment or show feedback instantly using the active language
      // Using a closure or timeout to ensure language state is accessed
    });
  }, []);

  // Show CV ready feedback once ready and when language changes (if not shown yet)
  const [hasShownCvFeedback, setHasShownCvFeedback] = useState(false);
  useEffect(() => {
    if (isCvReady && !hasShownCvFeedback) {
      showFeedback(translations[language].cvLoadedSuccess, 'success');
      setHasShownCvFeedback(true);
    }
  }, [isCvReady, language, hasShownCvFeedback]);

  // Helper to show brief feedback notifications
  function showFeedback(message: string, type: 'success' | 'info' | 'error' = 'info') {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  }

  // Select Preset Target to display in modal popup
  function handlePresetSelected(preset: SamplePreset) {
    setActivePresetForPreview(preset);
  }

  // Load Preset directly into the analysis workspace
  const handleLoadPreset = (preset: SamplePreset) => {
    const url = preset.generateUrl();
    const img: AppImage = {
      name: preset.name,
      url: url,
      width: 800,
      height: 800,
      rotation: 0,
    };
    setCurrentImage(img);
    setRotation(0);
    setActiveTool(ActiveTool.PanZoom);

    setCalibration({
      pixelsPerMillimeter: preset.pixelsPerMm,
      caliperA: { x: 150, y: 680 },
      caliperB: { x: 235, y: 680 },
      spanMm: 10,
      referenceCircleCenter: { x: 300, y: 680 },
      isValid: true,
      isLocked: false,
    });

    setBullet({
      ...initialBullet,
      center: preset.bulletCenter,
      detectedCenter: preset.bulletCenter,
      isLocked: false,
    });

    setScoringLine({
      ...initialScoringLine,
      center: preset.ringCenter,
      isCustomBoundary: false,
      boundaryRadiusPixels: 15 * preset.pixelsPerMm,
    });

    setActivePresetForPreview(null);
    showFeedback(translations[language].customImageSuccess, 'success');
  };

  // Custom user image upload handler
  const handleImageSelected = (img: AppImage) => {
    setCurrentImage(img);
    setRotation(0);
    setActiveTool(ActiveTool.PanZoom);

    // Clear previous analysis state
    setCalibration({
      ...initialCalibration,
      pixelsPerMillimeter: 25.0, // default starting scale (larger scale for ease of use)
      caliperA: { x: Math.round(img.width * 0.2), y: Math.round(img.height * 0.85) },
      caliperB: { x: Math.round(img.width * 0.35), y: Math.round(img.height * 0.85) },
      referenceCircleCenter: { x: Math.round(img.width * 0.5), y: Math.round(img.height * 0.7) }, // center-lower visible position
      isValid: true,
      isLocked: false,
    });
    setBullet(initialBullet);
    setScoringLine({
      ...initialScoringLine,
      center: { x: Math.round(img.width * 0.5), y: Math.round(img.height * 0.45) },
    });

    showFeedback(translations[language].customImageSuccess, 'info');
    setMobileView('canvas');
  };

  // Perform Ruler Auto CV analysis
  const handleAutoCalibrateRuler = () => {
    if (!currentImage) return;

    // Use Ruler ROI region (we can look at a bounding box around our caliper endpoints)
    const margin = 35;
    const x = Math.min(calibration.caliperA.x, calibration.caliperB.x) - margin;
    const y = Math.min(calibration.caliperA.y, calibration.caliperB.y) - margin;
    const width = Math.abs(calibration.caliperB.x - calibration.caliperA.x) + margin * 2;
    const height = margin * 2;

    const rulerRoi = { x: Math.max(0, x), y: Math.max(0, y), width, height };

    // Get pixel analysis from canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentImage.width;
    tempCanvas.height = currentImage.height;
    const ctx = tempCanvas.getContext('2d');
    const img = new Image();
    img.src = currentImage.url;
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const res = autoCalibrateRulerPureJS(tempCanvas, rulerRoi);
      if (res.pixelsPerMm > 0) {
        setCalibration((prev) => ({
          ...prev,
          pixelsPerMillimeter: res.pixelsPerMm,
          isValid: true,
          // Update caliper markers to align with detected tick ends
          caliperA: { x: res.ticks[0], y: prev.caliperA.y },
          caliperB: { x: res.ticks[res.ticks.length - 1], y: prev.caliperB.y },
          spanMm: res.ticks.length - 1,
        }));
        showFeedback(translations[language].rulerDetectedSuccess.replace('{ppm}', res.pixelsPerMm.toFixed(3)), 'success');
      } else {
        showFeedback(translations[language].rulerDetectedError, 'error');
      }
    };
  };

  // Perform Bullet Center CV Analysis
  const handleAutoDetectBullet = () => {
    if (!currentImage || !bullet.roi) {
      showFeedback(translations[language].bulletRoiError, 'error');
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentImage.width;
    tempCanvas.height = currentImage.height;
    const ctx = tempCanvas.getContext('2d');
    const img = new Image();
    img.src = currentImage.url;
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const res = detectBulletCenterPureJS(tempCanvas, bullet.roi!);

      setBullet((prev) => ({
        ...prev,
        center: res.center,
        detectedCenter: res.center,
        contour: res.contour,
        convexHull: res.convexHull,
        holeRadiusPixels: res.holeRadius,
        isCustomCenter: false,
      }));

      showFeedback(translations[language].bulletDetectedSuccess, 'success');
    };
  };

  // Perform Scoring Line Auto CV Analysis
  const handleAutoFitScoringLine = () => {
    if (!currentImage || !scoringLine.roi) {
      showFeedback(translations[language].ringRoiError, 'error');
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentImage.width;
    tempCanvas.height = currentImage.height;
    const ctx = tempCanvas.getContext('2d');
    const img = new Image();
    img.src = currentImage.url;
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const res = fitScoringLinePureJS(tempCanvas, scoringLine.roi!);

      if (res.fittedCircle) {
        const printedCenter = { x: res.fittedCircle.x, y: res.fittedCircle.y };

        // Add printed half-thickness of the VSC ring line (e.g., 0.4mm)
        // to find the exact outer edge boundary of the higher score side!
        const lineThicknessPx = 0.8 * calibration.pixelsPerMillimeter;
        const outerEdgePx = res.fittedCircle.radius + (lineThicknessPx / 2);

        setScoringLine((prev) => ({
          ...prev,
          center: printedCenter,
          boundaryRadiusPixels: outerEdgePx,
          isCustomBoundary: false,
        }));
        showFeedback(
          translations[language].ringDetectedSuccess
            .replace('{x}', printedCenter.x.toFixed(1))
            .replace('{y}', printedCenter.y.toFixed(1)),
          'success'
        );
      } else {
        // Fallback: use a default radius centered in ROI
        const roi = scoringLine.roi!;
        const fallbackRadiusMm = scoringLine.selectedRingScore === 10 ? 15.4 : 30.4;
        const fallbackRadiusPx = fallbackRadiusMm * calibration.pixelsPerMillimeter;
        setScoringLine((prev) => ({
          ...prev,
          center: { x: roi.x + roi.width / 2, y: roi.y + roi.height / 2 },
          boundaryRadiusPixels: fallbackRadiusPx,
          isCustomBoundary: true,
        }));
        showFeedback(translations[language].ringDetectedFallback, 'info');
      }
    };
  };

  const handleReset = () => {
    setCurrentImage(null);
    setCalibration(initialCalibration);
    setBullet(initialBullet);
    setScoringLine(initialScoringLine);
    setActiveTool(ActiveTool.PanZoom);
    showFeedback(translations[language].workspaceCleared, 'info');
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0F1012] text-[#E4E3E0] font-sans" id="vsc-root">
      {/* Header component */}
      <Header
        isCvReady={isCvReady}
        onOpenRules={() => setShowRulesModal(true)}
        language={language}
        setLanguage={setLanguage}
      />

      {/* Mobile Web Tab Navigation */}
      <div className="flex lg:hidden bg-[#151619] border-b border-[#333] font-mono text-[11px] font-bold z-10" id="vsc-mobile-tabs">
        <button
          onClick={() => setMobileView('controls')}
          className={`flex-1 py-3 text-center transition-all ${
            mobileView === 'controls'
              ? 'text-[#F27D26] border-b-2 border-[#F27D26] bg-[#1F2023]'
              : 'text-[#888] hover:text-[#fff] hover:bg-[#1A1B1E]'
          }`}
        >
          {translations[language].controlsTab}
        </button>
        <button
          onClick={() => setMobileView('canvas')}
          className={`flex-1 py-3 text-center transition-all ${
            mobileView === 'canvas'
              ? 'text-white border-b-2 border-white bg-[#1F2023]'
              : 'text-[#888] hover:text-[#fff] hover:bg-[#1A1B1E]'
          }`}
        >
          {translations[language].canvasTab}
        </button>
        <button
          onClick={() => setMobileView('results')}
          className={`flex-1 py-3 text-center transition-all ${
            mobileView === 'results'
              ? 'text-[#F27D26] border-b-2 border-[#F27D26] bg-[#1F2023]'
              : 'text-[#888] hover:text-[#fff] hover:bg-[#1A1B1E]'
          }`}
        >
          {translations[language].resultsTab}
        </button>
      </div>

      {/* Main App Content Layout */}
      <main className="flex flex-col lg:flex-row flex-1 overflow-hidden relative bg-[#0F1012]" id="vsc-main-layout">
        {/* Sidebar Controls Panel */}
        <div className={`${mobileView === 'controls' ? 'block w-full' : 'hidden'} lg:block lg:w-80 lg:flex-shrink-0 h-full`}>
          <SidebarControls
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            calibration={calibration}
            setCalibration={setCalibration}
            bullet={bullet}
            setBullet={setBullet}
            scoringLine={scoringLine}
            setScoringLine={setScoringLine}
            currentImage={currentImage}
            onImageSelected={handleImageSelected}
            onPresetSelected={handlePresetSelected}
            rotation={rotation}
            setRotation={setRotation}
            isCvReady={isCvReady}
            onAutoCalibrateRuler={handleAutoCalibrateRuler}
            onAutoDetectBullet={handleAutoDetectBullet}
            onAutoFitScoringLine={handleAutoFitScoringLine}
            language={language}
          />
        </div>

        {/* Workspace interactive Canvas drawing area */}
        <div className={`${mobileView === 'canvas' ? 'block flex-1 h-full' : 'hidden'} lg:block lg:flex-1 lg:h-full`}>
          <WorkspaceCanvas
            currentImage={currentImage}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            calibration={calibration}
            setCalibration={setCalibration}
            bullet={bullet}
            setBullet={setBullet}
            scoringLine={scoringLine}
            setScoringLine={setScoringLine}
            rotation={rotation}
            language={language}
            onImageSelected={handleImageSelected}
            onReset={handleReset}
            exportReportRef={exportReportRef}
          />
        </div>

        {/* Right Score Verification panel */}
        <section className={`${mobileView === 'results' ? 'block w-full' : 'hidden'} lg:block lg:w-80 lg:flex-shrink-0 border-l lg:border-[#333] bg-[#151619] p-4 overflow-y-auto custom-scrollbar h-full lg:h-[calc(100vh-56px)]`} id="vsc-results-section">
          <ResultPanel
            calibration={calibration}
            bullet={bullet}
            scoringLine={scoringLine}
            onReset={handleReset}
            language={language}
            exportReportRef={exportReportRef}
          />
        </section>
      </main>

      {/* Dynamic Feedback Toast notification */}
      {feedback && (
        <div className="absolute top-16 right-4 z-50" id="vsc-feedback-toast">
          <div
            className={`px-4 py-2.5 rounded border shadow-2xl flex items-center space-x-2 font-mono text-xs ${
              feedback.type === 'success'
                ? 'bg-[#121E16] border-green-500 text-green-400'
                : feedback.type === 'error'
                ? 'bg-[#201214] border-red-500 text-red-400'
                : 'bg-[#151619] border-[#F27D26] text-[#E4E3E0]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${feedback.type === 'success' ? 'bg-green-400 animate-pulse' : feedback.type === 'error' ? 'bg-red-400 animate-pulse' : 'bg-[#F27D26] animate-pulse'}`} />
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Help Modal Overlay: Official VSC Scoring Rules summary */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="vsc-rules-modal">
          <div className="bg-[#151619] border border-[#333] rounded w-full max-w-lg p-5 shadow-2xl text-[#E4E3E0] flex flex-col justify-between max-h-[90vh] font-mono">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[#333]">
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-[#F27D26]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {translations[language].rulesTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="p-1 hover:bg-[#2A2B2E] hover:text-white rounded text-[#666] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-[11px] leading-relaxed overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar text-[#888]">
                {/* Official VSC Target Sample Presets */}
                <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E] space-y-2">
                  <h4 className="font-bold text-[#E4E3E0] uppercase tracking-wide text-[10px] text-[#F27D26]">
                    {translations[language].officialVscTargets}
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {presets.map((preset, idx) => {
                      const label = String.fromCharCode(65 + idx);
                      let presetName = preset.name;
                      let presetDesc = preset.description;
                      if (preset.id === 'target-10-touch') {
                        presetName = translations[language].preset1Name;
                        presetDesc = translations[language].preset1Desc;
                      } else if (preset.id === 'target-10-miss') {
                        presetName = translations[language].preset2Name;
                        presetDesc = translations[language].preset2Desc;
                      } else if (preset.id === 'target-10-torn') {
                        presetName = translations[language].preset3Name;
                        presetDesc = translations[language].preset3Desc;
                      }

                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setShowRulesModal(false);
                            handlePresetSelected(preset);
                          }}
                          className="w-full bg-[#151619] border border-[#333] hover:border-[#F27D26]/60 hover:bg-[#202125] text-[#E4E3E0] hover:text-white rounded py-2 px-1 font-mono text-center flex flex-col items-center justify-center cursor-pointer transition-all group"
                          title={`${presetName}: ${presetDesc}`}
                        >
                          <span className="text-[14px] font-bold text-white group-hover:text-[#F27D26] block">
                            {label}
                          </span>
                          <span className="text-[7px] text-[#666] uppercase font-semibold mt-0.5 tracking-tighter">
                            {preset.expectedResult === 'HIGHER SCORE' ? (language === 'vi' ? 'ĐIỂM CAO' : 'HIGHER') : (language === 'vi' ? 'ĐIỂM THẤP' : 'LOWER')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                  <h4 className="font-bold text-[#E4E3E0] mb-1 uppercase tracking-wide text-[10px] text-[#F27D26]">
                    {translations[language].clause1Title}
                  </h4>
                  <p>
                    {translations[language].clause1Desc}
                  </p>
                </div>

                <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                  <h4 className="font-bold text-[#E4E3E0] mb-1 uppercase tracking-wide text-[10px] text-green-400">
                    {translations[language].clause2Title}
                  </h4>
                  <p>
                    {translations[language].clause2Desc}
                  </p>
                </div>

                <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                  <h4 className="font-bold text-[#E4E3E0] mb-1 uppercase tracking-wide text-[10px] text-blue-400">
                    {translations[language].clause3Title}
                  </h4>
                  <p>
                    {translations[language].clause3Desc}
                  </p>
                </div>

                <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                  <h4 className="font-bold text-[#E4E3E0] mb-1 uppercase tracking-wide text-[10px] text-amber-500">
                    {translations[language].clause4Title}
                  </h4>
                  <p>
                    {translations[language].clause4Desc}
                  </p>
                  <ul className="list-disc pl-4 mt-1.5 space-y-1">
                    <li>{translations[language].clause4Bullet1}</li>
                    <li>{translations[language].clause4Bullet2}</li>
                    <li>{translations[language].clause4Bullet3}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-[#333] pt-3.5 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="bg-[#F27D26] hover:bg-[#ff8e3c] text-black text-[10px] font-bold py-2 px-4 rounded-sm transition-all uppercase tracking-wider cursor-pointer"
              >
                {translations[language].acceptDismiss}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Target Preview Modal */}
      {activePresetForPreview && (() => {
        let presetName = activePresetForPreview.name;
        let presetDesc = activePresetForPreview.description;
        let presetReason = activePresetForPreview.reason;

        if (activePresetForPreview.id === 'target-10-touch') {
          presetName = translations[language].preset1Name;
          presetDesc = translations[language].preset1Desc;
          presetReason = translations[language].preset1Reason;
        } else if (activePresetForPreview.id === 'target-10-miss') {
          presetName = translations[language].preset2Name;
          presetDesc = translations[language].preset2Desc;
          presetReason = translations[language].preset2Reason;
        } else if (activePresetForPreview.id === 'target-10-torn') {
          presetName = translations[language].preset3Name;
          presetDesc = translations[language].preset3Desc;
          presetReason = translations[language].preset3Reason;
        }

        const t = modalTranslations[language];

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="vsc-preset-preview-modal">
            <div className="bg-[#151619] border border-[#333] rounded w-full max-w-lg p-5 shadow-2xl text-[#E4E3E0] flex flex-col justify-between max-h-[95vh] font-mono">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[#333]">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-[#F27D26]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      {t.modalTitle}
                    </h3>
                  </div>
                  <button
                    onClick={() => setActivePresetForPreview(null)}
                    className="p-1 hover:bg-[#2A2B2E] hover:text-white rounded text-[#666] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-[11px] leading-relaxed overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                  {/* Generated Target Image */}
                  <div className="flex justify-center bg-[#0E0F11] p-3 rounded border border-[#2A2B2E] relative overflow-hidden">
                    <img
                      src={activePresetForPreview.generateUrl()}
                      alt={presetName}
                      className="w-56 h-56 object-contain border border-[#333] rounded bg-black shadow-inner"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                    <h4 className="font-bold text-[#E4E3E0] mb-1.5 uppercase tracking-wide text-[10px]">
                      {presetName}
                    </h4>
                    <p className="text-[#888]">
                      {presetDesc}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                      <span className="text-[9px] font-bold text-[#666] uppercase block mb-1">{t.expectedResult}</span>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        activePresetForPreview.expectedResult === 'HIGHER SCORE'
                          ? 'bg-green-950/40 border-green-900/50 text-green-400'
                          : 'bg-red-950/40 border-red-900/50 text-red-400'
                      }`}>
                        {activePresetForPreview.expectedResult === 'HIGHER SCORE' ? translations[language].resolvedHigher : translations[language].resolvedLower}
                      </span>
                    </div>

                    <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                      <span className="text-[9px] font-bold text-[#666] uppercase block mb-1">{t.standardScale}</span>
                      <span className="text-[10px] text-blue-400 font-bold block mt-0.5">
                        {activePresetForPreview.pixelsPerMm} px/mm
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#0E0F11] p-3 rounded border border-[#2A2B2E]">
                    <h4 className="font-bold text-[#F27D26] mb-1 uppercase tracking-wide text-[10px]">
                      {t.reasoning}
                    </h4>
                    <p className="text-[#888]">
                      {presetReason}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-[#333] pt-3.5 flex justify-end space-x-2">
                <button
                  onClick={() => handleLoadPreset(activePresetForPreview)}
                  className="bg-[#F27D26] hover:bg-[#F27D26]/90 text-black border border-transparent text-[10px] font-bold py-2 px-4 rounded-sm transition-all uppercase tracking-wider cursor-pointer"
                >
                  {language === 'vi' ? 'SỬ DỤNG BIA NÀY' : 'USE THIS TARGET'}
                </button>
                <button
                  onClick={() => setActivePresetForPreview(null)}
                  className="bg-[#2A2B2E] hover:bg-[#333] text-[#E4E3E0] hover:text-white border border-[#444] text-[10px] font-bold py-2 px-4 rounded-sm transition-all uppercase tracking-wider cursor-pointer"
                >
                  {t.closeBtn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
