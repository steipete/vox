import { motion } from "framer-motion";

import { easeOut } from "../lib/easing";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: easeOut }}
      className="max-w-3xl mx-auto text-center mb-16 md:mb-24"
    >
      {eyebrow && (
        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold tracking-wider uppercase text-teal-300 border border-teal-300/20 bg-teal-300/5 mb-4">
          {eyebrow}
        </span>
      )}
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-gradient-subtle mb-5">
        {title}
      </h2>
      {description && (
        <p className="text-lg md:text-xl text-[#a1a1b6] leading-relaxed">{description}</p>
      )}
    </motion.div>
  );
}

export default SectionHeader;
