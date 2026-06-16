import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { AudioWaveform, FileJson, Mic, Phone, Plug, Terminal } from "lucide-react";

import SectionHeader from "../components/SectionHeader";
import SpotlightCard from "../components/SpotlightCard";
import { easeOut } from "../lib/easing";

interface Feature {
  icon: ComponentType<{ className?: string; size?: number }>;
  title: string;
  description: string;
  accent: string;
  size: "large" | "standard";
}

const features: Feature[] = [
  {
    icon: AudioWaveform,
    title: "Native G.711 passthrough",
    description:
      "Twilio speaks μ-law; OpenAI Realtime speaks μ-law. Vox keeps it that way — no resampling, no DSP, no latency added.",
    accent: "from-teal-300/20 to-teal-300/5",
    size: "large",
  },
  {
    icon: Mic,
    title: "Smart barge-in",
    description:
      "Caller interrupts? Vox clears Twilio playback, cancels the in-flight response, and truncates the assistant transcript at the exact millisecond.",
    accent: "from-violet-300/20 to-violet-300/5",
    size: "large",
  },
  {
    icon: Plug,
    title: "Agent tool adapter",
    description:
      "Expose query_agent as an HTTP endpoint or a JSONL subprocess. Your voice model can now call your APIs, databases, or business logic.",
    accent: "from-blue-300/20 to-blue-300/5",
    size: "standard",
  },
  {
    icon: Terminal,
    title: "Local simulate mode",
    description:
      "Iterate on prompts and tool calls from your terminal. No Twilio account needed, no phone numbers, no carrier charges.",
    accent: "from-teal-300/20 to-teal-300/5",
    size: "standard",
  },
  {
    icon: FileJson,
    title: "Per-call logs",
    description:
      "Every Twilio event, OpenAI event, and Vox internal event is written as JSONL to a local call directory for observability and debugging.",
    accent: "from-violet-300/20 to-violet-300/5",
    size: "standard",
  },
  {
    icon: Phone,
    title: "Outbound dial",
    description:
      "Place outbound calls with vox dial. Point them at your server's TwiML and let the model start the conversation.",
    accent: "from-blue-300/20 to-blue-300/5",
    size: "standard",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: easeOut,
    },
  },
};

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  const largeClasses = feature.size === "large" ? "md:col-span-2" : "";

  return (
    <motion.div variants={itemVariants} className={largeClasses}>
      <SpotlightCard className="h-full p-6 md:p-8" glowColor="rgba(94, 234, 212, 0.12)">
        <div className="flex flex-col h-full">
          <div
            className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.accent} border border-white/[0.08] mb-5`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-[#f5f5f7] mb-3">{feature.title}</h3>
          <p className="text-[#a1a1b6] leading-relaxed text-base">{feature.description}</p>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

export function Features() {
  return (
    <section className="relative py-24 md:py-32 px-4 sm:px-6 lg:px-8" id="features">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Features"
          title="Everything you need for a voice agent."
          description="No DSP, no black boxes, no monthly platform fees. Just a self-hosted bridge with production-grade call control."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
        >
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default Features;
