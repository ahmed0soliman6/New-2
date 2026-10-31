import React from 'react';

interface SoliMedicalLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  glow?: boolean;
}

export const SoliMedicalLogo: React.FC<SoliMedicalLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  glow = true,
}) => {
  const dimensions = {
    sm: { box: 'w-8 h-8', textTitle: 'text-sm', textSub: 'text-[9px]' },
    md: { box: 'w-11 h-11', textTitle: 'text-base', textSub: 'text-[11px]' },
    lg: { box: 'w-16 h-16', textTitle: 'text-xl', textSub: 'text-xs' },
    xl: { box: 'w-24 h-24', textTitle: 'text-3xl', textSub: 'text-sm' },
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* SVG Icon Container with exact new design path */}
      <div
        className={`${dimensions.box} relative shrink-0 flex items-center justify-center overflow-visible`}
      >
        <svg
          viewBox="0 0 800 800"
          className="w-full h-full object-contain overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Background Canvas Gradient */}
            <linearGradient id="bgCanvasGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0e172a"/>
              <stop offset="50%" stopColor="#080f1e"/>
              <stop offset="100%" stopColor="#020610"/>
            </linearGradient>

            {/* Medical Cyan/Teal Gradient for M and ECG connector pulse */}
            <linearGradient id="cyanTealGradM" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8"/>
              <stop offset="30%" stopColor="#00f2fe"/>
              <stop offset="75%" stopColor="#00c2cb"/>
              <stop offset="100%" stopColor="#0284c7"/>
            </linearGradient>

            {/* Crisp White Ribbon Gradient for S */}
            <linearGradient id="crispWhiteGradS" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff"/>
              <stop offset="70%" stopColor="#f8fafc"/>
              <stop offset="100%" stopColor="#cbd5e1"/>
            </linearGradient>

            {/* Medical Cross Balanced Gradient */}
            <linearGradient id="balancedCrossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d2e49"/>
              <stop offset="50%" stopColor="#142135"/>
              <stop offset="100%" stopColor="#0c1626"/>
            </linearGradient>

            {/* Balanced Cross Outline Glow */}
            <linearGradient id="balancedCrossOutline" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00c2cb" stopOpacity="0.65"/>
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#00c2cb" stopOpacity="0.65"/>
            </linearGradient>

            {/* Outer Squircle Rim Stroke Gradient */}
            <linearGradient id="squircleRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00c2cb" stopOpacity="0.5"/>
              <stop offset="50%" stopColor="#1e293b" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4"/>
            </linearGradient>

            {/* Neon Glow Filter */}
            <filter id="vitalGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Drop Shadow for clean layer separation */}
            <filter id="cleanShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="12" stdDeviation="20" floodColor="#000000" floodOpacity="0.75"/>
            </filter>
          </defs>

          {/* Container Squircle Background */}
          <rect width="800" height="800" rx="160" fill="url(#bgCanvasGrad)"/>
          <rect x="3" y="3" width="794" height="794" rx="157" fill="none" stroke="url(#squircleRimGrad)" strokeWidth="3.5"/>
          <rect x="15" y="15" width="770" height="770" rx="146" fill="none" stroke="#162235" strokeWidth="1.8" opacity="0.6"/>

          {/* Soft Ambient Glow behind the center */}
          <circle cx="400" cy="315" r="240" fill="#00c2cb" opacity="0.1" filter="url(#vitalGlow)"/>

          {/* ==================== MEDICAL CROSS ==================== */}
          <g transform="translate(80, 55)" opacity="0.9">
            <path
              d="M 210 20 C 210 9 219 0 230 0 L 410 0 C 421 0 430 9 430 20 L 430 155 L 620 155 C 631 155 640 164 640 175 L 640 335 C 640 346 631 355 620 355 L 430 355 L 430 490 C 430 501 421 510 410 510 L 230 510 C 219 510 210 501 210 490 L 210 355 L 20 355 C 9 355 0 346 0 335 L 0 175 C 0 164 9 155 20 155 L 210 155 Z"
              fill="url(#balancedCrossGrad)"
              stroke="url(#balancedCrossOutline)"
              strokeWidth="4"
            />
            <path
              d="M 218 28 C 218 20 224 14 232 14 L 408 14 C 416 14 422 20 422 28 L 422 163 L 612 163 C 620 163 626 169 626 177 L 626 333 C 626 341 620 347 612 347 L 422 347 L 422 482 C 422 490 416 496 408 496 L 232 496 C 224 496 218 490 218 482 L 218 347 L 28 347 C 20 347 14 341 14 333 L 14 177 C 14 169 20 163 28 163 L 218 163 Z"
              fill="none"
              stroke="#00c2cb"
              strokeOpacity="0.3"
              strokeWidth="2"
            />
            <line x1="28" y1="245" x2="190" y2="245" stroke="#00c2cb" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.3" />
            <line x1="450" y1="245" x2="612" y2="245" stroke="#00c2cb" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.3" />
          </g>

          {/* ==================== MAIN EMBLEM: S MERGED WITH M VIA CENTRAL ECG PULSE ==================== */}
          <g filter="url(#cleanShadow)">
            {/* LETTER "S" */}
            <path
              d="M 290 145 C 215 105, 55 115, 50 215 C 46 280, 135 300, 185 320 C 245 342, 260 395, 255 440 C 245 508, 155 536, 76 520 C 52 515, 40 495, 40 472"
              fill="none"
              stroke="url(#crispWhiteGradS)"
              strokeWidth="42"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* ECG PULSE CONNECTOR */}
            <path
              d="M 185 320 L 232 320 L 250 250 L 276 430 L 305 170 L 336 385 L 358 290 L 378 320 L 410 320"
              fill="none"
              stroke="url(#cyanTealGradM)"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#vitalGlow)"
            />

            {/* Pulse rhythm points */}
            <circle cx="305" cy="170" r="13" fill="#ffffff" filter="url(#vitalGlow)" />
            <circle cx="276" cy="430" r="10" fill="#38bdf8" />
            <circle cx="336" cy="385" r="9" fill="#00f2fe" />
            <circle cx="250" cy="250" r="8" fill="#38bdf8" />
            <circle cx="358" cy="290" r="8" fill="#00f2fe" />

            {/* LETTER "M" */}
            <path
              d="M 410 490 L 410 190 L 512 375 L 630 190 L 755 490"
              fill="none"
              stroke="url(#cyanTealGradM)"
              strokeWidth="42"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#vitalGlow)"
            />

            {/* Highlights */}
            <circle cx="410" cy="190" r="11" fill="#00f2fe" />
            <circle cx="512" cy="375" r="12" fill="#ffffff" filter="url(#vitalGlow)" />
            <circle cx="630" cy="190" r="11" fill="#00f2fe" />
          </g>
        </svg>
      </div>

      {/* Brand Text Lockup */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight text-white dark:text-white ${dimensions.textTitle}`}>
            Soli Medical
          </span>
          <span className={`font-black tracking-widest text-[#00c2cb] uppercase pt-1 ${dimensions.textSub}`}>
            Clinic
          </span>
        </div>
      )}
    </div>
  );
};
