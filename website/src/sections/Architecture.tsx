import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Phone, Plug, Sparkles } from "lucide-react";

import { MacWindow } from "../components/MacWindow";
import { SectionHeader } from "../components/SectionHeader";
import { easeOut } from "../lib/easing";

interface FlowNodeProps {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  hero?: boolean;
  delay?: number;
}

function FlowNode({ icon, label, sublabel, hero = false, delay = 0 }: FlowNodeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      whileHover={{ y: -6, transition: { duration: 0.25, ease: easeOut } }}
      transition={{ duration: 0.6, delay, ease: easeOut }}
      className={`relative flex flex-col items-center justify-center gap-3 p-5 md:p-6 rounded-2xl glass min-w-[140px] md:min-w-[180px] cursor-default ${
        hero ? "ring-1 ring-teal-300/30 shadow-[0_0_40px_rgba(94,234,212,0.12)]" : ""
      }`}
    >
      {hero && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-300/10 via-transparent to-violet-300/10"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div
        className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-xl ${
          hero
            ? "bg-gradient-to-br from-teal-300/20 to-violet-300/20 text-teal-300"
            : "bg-white/[0.04] text-[#a1a1b6]"
        }`}
      >
        {icon}
      </div>
      <div className="relative z-10 text-center">
        <div className="text-sm md:text-base font-semibold text-[#f5f5f7]">{label}</div>
        {sublabel && <div className="text-sm text-[#a1a1b6] mt-0.5">{sublabel}</div>}
      </div>
    </motion.div>
  );
}

interface ConnectorProps {
  direction?: "horizontal" | "vertical";
  delay?: number;
  className?: string;
}

function Connector({ direction = "horizontal", delay = 0, className = "" }: ConnectorProps) {
  const isVertical = direction === "vertical";

  return (
    <motion.div
      initial={{ opacity: 0, scale: isVertical ? 0.8 : 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: easeOut }}
      className={`relative flex items-center justify-center ${
        isVertical ? "h-12 md:h-16 w-2" : "h-2 w-full min-w-[32px]"
      } ${className}`}
    >
      <svg width="100%" height="100%" preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient
            id={`flow-gradient-${direction}`}
            x1="0%"
            y1="0%"
            x2={isVertical ? "0%" : "100%"}
            y2={isVertical ? "100%" : "0%"}
          >
            <stop offset="0%" stopColor="rgba(94, 234, 212, 0.4)" />
            <stop offset="50%" stopColor="rgba(167, 139, 250, 0.7)" />
            <stop offset="100%" stopColor="rgba(96, 165, 250, 0.4)" />
          </linearGradient>
        </defs>
        <motion.line
          x1="0"
          y1="0"
          x2={isVertical ? 0 : "100%"}
          y2={isVertical ? "100%" : 0}
          stroke={`url(#flow-gradient-${direction})`}
          strokeWidth="2"
          strokeDasharray="6 6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          animate={{ strokeDashoffset: [0, -24] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </motion.div>
  );
}

export function Architecture() {
  return (
    <section id="architecture" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Architecture"
        title="Twilio ↔ Vox ↔ OpenAI."
        description="A single bidirectional bridge. Audio stays G.711 end-to-end; events stay observable."
      />

      <div className="max-w-5xl mx-auto">
        <MacWindow title="architecture.graph" className="mac-shadow">
          <div className="p-6 md:p-12 min-h-[300px] sm:min-h-[360px] flex flex-col items-center justify-center">
            {/* Desktop layout */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_1fr_auto] gap-x-2 gap-y-2 items-center justify-items-center w-full">
              <FlowNode
                icon={<Phone size={24} />}
                label="Twilio"
                sublabel="PSTN call"
                delay={0.1}
              />
              <Connector direction="horizontal" delay={0.2} />
              <FlowNode
                icon={<ArrowLeftRight size={24} />}
                label="Vox"
                sublabel="The bridge"
                hero
                delay={0.3}
              />
              <Connector direction="horizontal" delay={0.4} />
              <FlowNode
                icon={<Sparkles size={24} />}
                label="OpenAI Realtime"
                sublabel="Speech-to-speech"
                delay={0.5}
              />

              <div />
              <div />
              <div className="flex flex-col items-center">
                <Connector direction="vertical" delay={0.6} />
                <FlowNode
                  icon={<Plug size={24} />}
                  label="Your Agent"
                  sublabel="via query_agent"
                  delay={0.7}
                />
              </div>
              <div />
              <div />
            </div>

            {/* Mobile layout */}
            <div className="flex md:hidden flex-col items-center gap-3">
              <FlowNode
                icon={<Phone size={24} />}
                label="Twilio"
                sublabel="PSTN call"
                delay={0.1}
              />
              <Connector direction="vertical" delay={0.2} />
              <FlowNode
                icon={<ArrowLeftRight size={24} />}
                label="Vox"
                sublabel="The bridge"
                hero
                delay={0.3}
              />
              <Connector direction="vertical" delay={0.4} />
              <FlowNode
                icon={<Plug size={24} />}
                label="Your Agent"
                sublabel="via query_agent"
                delay={0.5}
              />
              <Connector direction="vertical" delay={0.6} />
              <FlowNode
                icon={<Sparkles size={24} />}
                label="OpenAI Realtime"
                sublabel="Speech-to-speech"
                delay={0.7}
              />
            </div>
          </div>
        </MacWindow>
      </div>
    </section>
  );
}

export default Architecture;
