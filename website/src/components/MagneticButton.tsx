import { useRef } from "react";
import type { ReactNode, MouseEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  maxOffset?: number;
}

export function MagneticButton({ children, className = "", maxOffset = 12 }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() ?? false;

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current || reducedMotion) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const maxDistance = Math.max(rect.width, rect.height) / 2;

    const rawX = (dx / maxDistance) * maxOffset;
    const rawY = (dy / maxDistance) * maxOffset;
    const rawDistance = Math.sqrt(rawX * rawX + rawY * rawY);
    const scale = rawDistance > maxOffset ? maxOffset / rawDistance : 1;

    x.set(rawX * scale);
    y.set(rawY * scale);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (reducedMotion) {
    return <div className={`inline-block ${className}`}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}

export default MagneticButton;
