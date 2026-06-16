import { useRef, useState } from "react";
import type { ReactNode, MouseEvent } from "react";
import { motion } from "framer-motion";
import { TiltCard } from "./TiltCard";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  glowColor = "rgba(94, 234, 212, 0.15)",
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <TiltCard
      className={`relative rounded-2xl border border-white/[0.08] bg-[#12121c]/60 backdrop-blur-xl overflow-hidden ${className}`}
    >
      <motion.div
        ref={ref}
        className="relative h-full"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ y: -4, transition: { duration: 0.25 } }}
      >
        <div
          className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${glowColor}, transparent 60%)`,
          }}
        />
        <div className="relative z-10">{children}</div>
      </motion.div>
    </TiltCard>
  );
}

export default SpotlightCard;
