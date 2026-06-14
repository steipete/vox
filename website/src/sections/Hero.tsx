import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

import MacWindow from "../components/MacWindow";
import MagneticButton from "../components/MagneticButton";
import { Parallax } from "../components/Parallax";
import { GithubIcon } from "../components/icons";
import HeroIllustration from "../components/HeroIllustration";
import { easeOut } from "../lib/easing";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: easeOut,
    },
  },
};

const windowVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.9,
      ease: easeOut,
      delay: 0.35,
    },
  },
};

export function Hero() {
  const bars = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      // deterministic pseudo-random values derived from index
      const hash = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      const fraction = hash - Math.floor(hash);
      return {
        key: i,
        midHeight: 28 + Math.floor(fraction * 32),
        duration: 0.9 + fraction * 0.6,
      };
    });
  }, []);

  return (
    <section className="min-h-screen flex items-center py-24 md:py-32 px-4 sm:px-6 lg:px-8 xl:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative max-w-2xl"
        >
          {/* Soft radial glow behind the headline */}
          <div
            className="absolute -left-24 -top-24 w-[28rem] h-[28rem] rounded-full blur-3xl -z-10 pointer-events-none opacity-60"
            style={{
              background:
                "radial-gradient(circle at center, rgba(94, 234, 212, 0.18) 0%, rgba(167, 139, 250, 0.1) 35%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          <motion.div variants={itemVariants}>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold tracking-wider uppercase text-teal-300 border border-teal-300/20 bg-teal-300/10 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse" />
              Open-source bridge
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="relative text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-tight text-[#f5f5f7] mb-6"
          >
            Run your own <span className="text-gradient">AI phone agent</span>.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-[#a1a1b6] leading-relaxed mb-9 max-w-xl"
          >
            Vox wires Twilio calls to OpenAI Realtime in minutes — with native G.711 audio, smart
            barge-in, and a plug-in tool adapter for your backend.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
          >
            <MagneticButton>
              <a
                href="#quickstart"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#f5f5f7] text-[#05050a] font-medium text-sm hover:bg-white transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Read the docs
              </a>
            </MagneticButton>
            <MagneticButton>
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg glass text-[#f5f5f7] font-medium text-sm hover:bg-white/10 transition-colors"
              >
                <GithubIcon className="w-4 h-4" />
                View on GitHub
              </a>
            </MagneticButton>
          </motion.div>
        </motion.div>

        <motion.div
          variants={windowVariants}
          initial="hidden"
          animate="visible"
          className="relative animate-float"
        >
          {/* Large, softly blurred hero illustration offset behind the window */}
          <Parallax
            speed={0.12}
            className="absolute -left-[15%] top-1/2 -translate-y-1/2 w-[140%] h-auto -z-10 opacity-[0.18] blur-3xl pointer-events-none hidden lg:block"
          >
            <HeroIllustration className="w-full h-auto" aria-hidden="true" />
          </Parallax>

          <MacWindow
            title="Vox Bridge"
            className="relative z-10 w-full max-w-sm sm:max-w-md lg:max-w-none mx-auto"
          >
            <div className="p-5 sm:p-8 bg-gradient-to-b from-[#12121c] to-[#0b0b12]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-teal-300 animate-pulse" />
                    <span className="text-sm font-medium text-[#f5f5f7]">Vox bridge active</span>
                  </div>
                  <p className="text-sm text-[#a1a1b6]">Call ID: vox_9f4e2a1b</p>
                </div>
                <div className="px-3 py-1 rounded-full text-sm font-medium text-teal-300 border border-teal-300/20 bg-teal-300/10">
                  LIVE
                </div>
              </div>

              <div className="space-y-4">
                <StatusRow label="Caller connected" status="connected" />
                <StatusRow label="Model speaking…" status="active" />
                <StatusRow label="Audio stream" status="active" />
              </div>

              <div className="mt-8 flex items-end justify-center gap-1 h-16">
                {bars.map((bar) => (
                  <motion.div
                    key={bar.key}
                    className="w-1.5 rounded-full bg-gradient-to-t from-teal-300/60 to-violet-300/60"
                    animate={{
                      height: [12, bar.midHeight, 12],
                    }}
                    transition={{
                      duration: bar.duration,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                      delay: bar.key * 0.04,
                    }}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between text-sm text-[#a1a1b6]">
                <span>audio/pcmu · 8kHz</span>
                <span className="text-teal-300">barge-in enabled</span>
              </div>
            </div>
          </MacWindow>

          <div className="absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-r from-teal-300/10 via-violet-300/10 to-blue-300/10 blur-2xl opacity-60" />
        </motion.div>
      </div>
    </section>
  );
}

interface StatusRowProps {
  label: string;
  status: "connected" | "active";
}

function StatusRow({ label, status }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[#0f0f16] border border-white/[0.06]">
      <span className="text-sm text-[#f5f5f7]">{label}</span>
      {status === "connected" ? (
        <span className="text-sm font-medium text-teal-300">Connected</span>
      ) : (
        <span className="flex items-center gap-1.5 text-sm font-medium text-violet-300">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-pulse" />
          Active
        </span>
      )}
    </div>
  );
}

export default Hero;
