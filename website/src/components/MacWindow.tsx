import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface MacWindowProps {
  children: ReactNode;
  title?: string;
  className?: string;
  trafficLights?: boolean;
}

export function MacWindow({
  children,
  title = "",
  className = "",
  trafficLights = true,
}: MacWindowProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden mac-shadow bg-[#12121c] border border-white/[0.08] ${className}`}
    >
      <div className="relative h-9 flex items-center px-4 gap-2 border-b border-white/[0.06] bg-[#0f0f16]">
        {trafficLights && (
          <div className="flex gap-2" aria-hidden="true">
            <motion.span
              className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/10"
              whileHover={{ scale: 1.2 }}
              transition={{ duration: 0.2 }}
            />
            <motion.span
              className="w-3 h-3 rounded-full bg-[#febc2e] border border-black/10"
              whileHover={{ scale: 1.2 }}
              transition={{ duration: 0.2 }}
            />
            <motion.span
              className="w-3 h-3 rounded-full bg-[#28c840] border border-black/10"
              whileHover={{ scale: 1.2 }}
              transition={{ duration: 0.2 }}
            />
          </div>
        )}
        {title && (
          <div className="absolute left-1/2 -translate-x-1/2 text-sm text-[#a1a1b6] font-medium tracking-wide">
            {title}
          </div>
        )}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

export default MacWindow;
