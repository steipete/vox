import { useRef } from "react";
import { motion, useTransform } from "framer-motion";

import { useScrollProgress } from "../hooks/useScrollProgress";

interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export function Parallax({ children, speed = 0.2, className = "" }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScrollProgress(ref);

  // Map element scroll progress (0 = top enters viewport, 1 = bottom leaves viewport)
  // to a vertical offset proportional to speed. Positive speed moves the element
  // slower than scroll (recedes); negative speed moves faster (approaches).
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}%`, `${-speed * 100}%`]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
