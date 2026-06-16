import { useState, type ComponentType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Code, Rocket } from "lucide-react";

import { GithubIcon } from "./icons";

interface DockItemDef {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  external: boolean;
}

const DOCK_ITEMS: DockItemDef[] = [
  {
    href: "https://github.com/steipete/vox",
    label: "GitHub",
    icon: GithubIcon,
    external: true,
  },
  {
    href: "#quickstart",
    label: "Quickstart",
    icon: Rocket,
    external: false,
  },
  {
    href: "#architecture",
    label: "Docs",
    icon: BookOpen,
    external: false,
  },
  {
    href: "https://github.com/steipete/vox/blob/main/examples/echo-agent.js",
    label: "Examples",
    icon: Code,
    external: true,
  },
];

function getNeighborScale(index: number, hoveredIndex: number | null): number {
  if (hoveredIndex === null) return 1;

  const distance = Math.abs(index - hoveredIndex);
  if (distance === 0) return 1; // The hovered item is handled by `whileHover`.
  if (distance === 1) return 1.08;
  if (distance === 2) return 1.03;
  return 1;
}

export function Dock() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-3xl glass shadow-2xl"
      aria-label="Shortcut dock"
    >
      {DOCK_ITEMS.map((item, index) => {
        const Icon = item.icon;
        const neighborScale = reducedMotion ? 1 : getNeighborScale(index, hoveredIndex);

        return (
          <motion.a
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer noopener" : undefined}
            className="group flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl text-[#a1a1b6] hover:text-[#f5f5f7] hover:bg-white/[0.05] transition-colors focus-visible:outline-offset-[-2px]"
            onHoverStart={() => setHoveredIndex(index)}
            onHoverEnd={() => setHoveredIndex(null)}
            whileHover={reducedMotion ? undefined : { scale: 1.15, y: -4 }}
            animate={{ scale: neighborScale }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
            aria-label={item.label}
          >
            <Icon size={22} className="shrink-0" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </motion.a>
        );
      })}
    </nav>
  );
}

export default Dock;
