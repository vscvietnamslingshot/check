import { HelpCircle, Activity, Info } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface HeaderProps {
  isCvReady: boolean;
  onOpenRules: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

export default function Header({ isCvReady, onOpenRules, language, setLanguage }: HeaderProps) {
  return (
    <header className="h-14 border-b border-[#333] flex items-center justify-between px-6 bg-[#151619] text-[#E4E3E0] select-none" id="vsc-header">
      <div className="flex items-center space-x-4">
        <div className="bg-[#F27D26] text-black font-bold px-2 py-0.5 text-xs">VSC</div>
        <h1 className="font-mono tracking-tighter text-base md:text-lg font-semibold flex items-center space-x-2">
          <span>{translations[language].varCheck}</span>
          <span className="text-[#666] font-normal text-xs md:text-sm">v1.0</span>
        </h1>
      </div>

      <div className="flex space-x-4 md:space-x-6 items-center text-[10px] uppercase tracking-widest font-mono">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${isCvReady ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-500 animate-pulse'}`}></span>
          <span className={isCvReady ? 'text-green-500 font-semibold' : 'text-amber-500'}>
            {isCvReady ? translations[language].systemReady : translations[language].initializing}
          </span>
        </div>
        <div className="text-[#888] hidden sm:inline">
          {isCvReady ? translations[language].opencvLoaded : translations[language].opencvPending}
        </div>

        {/* Language Selection Buttons */}
        <div className="flex items-center bg-[#2A2B2E]/60 border border-[#444] p-0.5 rounded" id="vsc-lang-switcher">
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-[#F27D26] text-black'
                : 'text-[#888] hover:text-[#E4E3E0]'
            }`}
            title="Switch to English"
          >
            ENG
          </button>
          <button
            onClick={() => setLanguage('vi')}
            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
              language === 'vi'
                ? 'bg-[#F27D26] text-black'
                : 'text-[#888] hover:text-[#E4E3E0]'
            }`}
            title="Chuyển sang Tiếng Việt"
          >
            VIE
          </button>
        </div>

        <button
          onClick={onOpenRules}
          className="flex items-center space-x-1.5 px-2 py-1 bg-[#2A2B2E]/60 border border-[#444] rounded text-[#888] hover:text-[#E4E3E0] hover:bg-[#333] transition-all cursor-pointer"
          id="btn-vsc-rules"
          title={translations[language].rulesHandbookTooltip}
        >
          <Info className="w-3.5 h-3.5 text-[#F27D26]" />
          <span className="text-[9px]">{translations[language].rulesHandbook}</span>
        </button>
      </div>
    </header>
  );
}
