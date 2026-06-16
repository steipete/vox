import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface HeroIllustrationProps extends React.SVGProps<SVGSVGElement> {}

export function HeroIllustration(props: HeroIllustrationProps) {
  const reducedMotion = useReducedMotion();
  const bridgePathRef = useRef<SVGPathElement>(null);
  const [bridgeLength, setBridgeLength] = useState<number | null>(null);

  useEffect(() => {
    if (bridgePathRef.current) {
      setBridgeLength(bridgePathRef.current.getTotalLength());
    }
  }, []);

  const motionOrStatic = <T,>(animated: T): T | undefined => {
    return reducedMotion ? undefined : animated;
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 480"
      fill="none"
      role="img"
      aria-label="Vox hero illustration"
      {...props}
    >
      <title>Vox hero illustration</title>
      <defs>
        <linearGradient
          id="hero-grad"
          x1="0"
          y1="240"
          x2="800"
          y2="240"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <radialGradient id="glow-teal" cx="200" cy="240" r="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5eead4" stopOpacity="0.18" />
          <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-violet" cx="600" cy="240" r="220" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0.16" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-blue" cx="400" cy="400" r="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#60a5fa" stopOpacity="0.12" />
          <stop offset="1" stopColor="#60a5fa" stopOpacity="0" />
        </radialGradient>
        <filter id="blur-40" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
        <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="800" height="480" fill="#05050a" />
      <circle cx="200" cy="240" r="200" fill="url(#glow-teal)" filter="url(#blur-40)" />
      <circle cx="600" cy="240" r="220" fill="url(#glow-violet)" filter="url(#blur-40)" />
      <circle cx="400" cy="400" r="160" fill="url(#glow-blue)" filter="url(#blur-40)" />

      {/* glass bubbles */}
      <motion.circle
        cx="220"
        cy="240"
        r="96"
        fill="rgba(18,18,28,0.55)"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1"
        animate={motionOrStatic({
          y: [0, -10, 0],
          opacity: [1, 0.92, 1],
        })}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx="580"
        cy="240"
        r="110"
        fill="rgba(18,18,28,0.55)"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1"
        animate={motionOrStatic({
          y: [0, 8, 0],
          opacity: [1, 0.9, 1],
        })}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.circle
        cx="80"
        cy="400"
        r="46"
        fill="rgba(18,18,28,0.35)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
        animate={motionOrStatic({
          y: [0, -6, 0],
          opacity: [1, 0.88, 1],
        })}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />
      <motion.circle
        cx="720"
        cy="80"
        r="40"
        fill="rgba(18,18,28,0.35)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
        animate={motionOrStatic({
          y: [0, 6, 0],
          opacity: [1, 0.88, 1],
        })}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* abstract phone + audio waves */}
      <g>
        <rect
          x="188"
          y="178"
          width="64"
          height="124"
          rx="16"
          fill="rgba(255,255,255,0.04)"
          stroke="url(#hero-grad)"
          strokeWidth="2"
        />
        <circle cx="220" cy="216" r="5" fill="#f5f5f7" opacity="0.85" />
        <path
          d="M204 250q16 14 32 0"
          stroke="#f5f5f7"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
        <motion.path
          d="M270 228q20-16 40 0"
          stroke="url(#hero-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
          animate={motionOrStatic({ opacity: [0.7, 1, 0.7] })}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M270 252q20 16 40 0"
          stroke="url(#hero-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
          animate={motionOrStatic({ opacity: [0.7, 1, 0.7] })}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
      </g>

      {/* neural / AI node */}
      <g filter="url(#glow-soft)">
        <motion.circle
          cx="580"
          cy="240"
          r="30"
          fill="url(#hero-grad)"
          style={{ transformOrigin: "580px 240px" }}
          animate={motionOrStatic({
            scale: [1, 1.15, 1],
            opacity: [1, 0.8, 1],
          })}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <circle cx="580" cy="240" r="14" fill="#05050a" />
        <circle cx="580" cy="240" r="5" fill="#f5f5f7" />
      </g>
      <motion.g
        style={{ transformOrigin: "580px 240px" }}
        animate={motionOrStatic({ rotate: [0, 360] })}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
      >
        <path
          d="M580 190 624 215v50l-44 25-44-25v-50z"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="580" cy="190" r="5" fill="#5eead4" />
        <circle cx="624" cy="215" r="5" fill="#a78bfa" />
        <circle cx="624" cy="265" r="5" fill="#60a5fa" />
        <circle cx="580" cy="290" r="5" fill="#5eead4" />
        <circle cx="536" cy="265" r="5" fill="#a78bfa" />
        <circle cx="536" cy="215" r="5" fill="#60a5fa" />
      </motion.g>

      {/* audio waveform bars */}
      <g>
        {[
          { x: 360, y: 224, h: 32, d: 0 },
          { x: 376, y: 212, h: 56, d: 0.08 },
          { x: 392, y: 232, h: 16, d: 0.16 },
          { x: 408, y: 204, h: 72, d: 0.24 },
          { x: 424, y: 228, h: 24, d: 0.32 },
          { x: 440, y: 216, h: 48, d: 0.4 },
          { x: 456, y: 232, h: 16, d: 0.48 },
        ].map((bar) => (
          <motion.rect
            key={bar.x}
            x={bar.x}
            y={bar.y}
            width="9"
            height={bar.h}
            rx="4.5"
            fill="url(#hero-grad)"
            opacity="0.9"
            style={{ transformOrigin: `${bar.x + 4.5}px ${bar.y + bar.h / 2}px` }}
            animate={motionOrStatic({
              scaleY: [1, 1.35, 0.7, 1.2, 1],
            })}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: bar.d,
            }}
          />
        ))}
      </g>

      {/* bridge connection */}
      <motion.path
        ref={bridgePathRef}
        d="M320 240c70-70 140 70 210 0"
        stroke="url(#hero-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        filter="url(#glow-soft)"
        strokeDasharray={bridgeLength ? `20 ${bridgeLength - 20}` : undefined}
        animate={motionOrStatic({
          strokeDashoffset: bridgeLength ? [0, -bridgeLength] : 0,
        })}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />
      <circle cx="320" cy="240" r="4" fill="#5eead4" filter="url(#glow-soft)" />
      <circle cx="530" cy="240" r="4" fill="#60a5fa" filter="url(#glow-soft)" />
    </svg>
  );
}

export default HeroIllustration;
