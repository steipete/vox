import { motion } from "framer-motion";
import { Code2, GitBranch, Layers, Shield } from "lucide-react";

import { easeOut } from "../lib/easing";

const highlights = [
  {
    icon: Code2,
    value: "40+",
    label: "tests included",
  },
  {
    icon: GitBranch,
    value: "MIT",
    label: "open source",
  },
  {
    icon: Layers,
    value: "Node 22+",
    label: "ESM / TypeScript",
  },
  {
    icon: Shield,
    value: "Self-hosted",
    label: "your data stays yours",
  },
];

const containerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: easeOut,
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: easeOut,
    },
  },
};

export function Highlights() {
  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="max-w-5xl mx-auto"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden bg-white/[0.06] border border-white/[0.08]">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                variants={cardVariants}
                className="bg-[#0b0b12] p-6 md:p-8 flex flex-col items-center text-center"
              >
                <div className="mb-3 text-teal-300">
                  <Icon size={20} strokeWidth={1.5} />
                </div>
                <div className="text-2xl md:text-3xl font-semibold text-[#f5f5f7] mb-1">
                  {item.value}
                </div>
                <div className="text-sm text-[#a1a1b6] uppercase tracking-wider">{item.label}</div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}

export default Highlights;
