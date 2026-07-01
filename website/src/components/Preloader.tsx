import { motion, useReducedMotion } from "framer-motion";

import { easeOut } from "../lib/easing";

export function Preloader() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const duration = prefersReducedMotion ? 0.3 : 0.6;

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#05050a]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, ease: easeOut }}
      aria-hidden="true"
    >
      {/* Subtle radial glow behind the logo */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(94, 234, 212, 0.08) 0%, rgba(167, 139, 250, 0.05) 40%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center">
        <motion.img
          src={`${import.meta.env.BASE_URL}vox-logo.svg`}
          alt=""
          className="w-16 h-16 mb-6 drop-shadow-[0_0_30px_rgba(94,234,212,0.25)]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration, ease: easeOut }}
        />
        <motion.p
          className="text-[#a1a1b6] text-xs font-medium uppercase tracking-[0.2em]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration,
            delay: duration * 0.2,
            ease: easeOut,
          }}
        >
          Loading Vox…
        </motion.p>
      </div>
    </motion.div>
  );
}

export default Preloader;
