import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import MacWindow from "../components/MacWindow";
import SectionHeader from "../components/SectionHeader";
import { easeOut } from "../lib/easing";

const TYPING_INTERVAL_MS = 35;
const LINE_DELAY_MS = 350;

const terminalLines = [
  { text: "$ pnpm install", color: "text-teal-300", indent: false },
  { text: "Packages: +42", color: "text-[#a1a1b6]", indent: true },
  {
    text: "Progress: resolved 42, reused 42, downloaded 0, added 42, done",
    color: "text-[#a1a1b6]",
    indent: true,
  },
  { text: "$ pnpm run dev -- simulate", color: "text-teal-300", indent: false },
  {
    text: "> Vox simulate ready. Type your message:",
    color: "text-teal-300",
    indent: true,
  },
  {
    text: "> Hello, what's my account balance?",
    color: "text-teal-300",
    indent: true,
  },
  {
    text: "[Model] Checking your balance via query_agent…",
    color: "text-violet-300",
    indent: true,
  },
];

function BlinkingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{
        duration: 0.9,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
      className="inline-block w-2 h-4 bg-teal-300/80 rounded-sm align-middle"
    />
  );
}

export function Terminal() {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  const isTyping = !prefersReducedMotion && lineIndex < terminalLines.length;
  const showFinalCursor = prefersReducedMotion || lineIndex >= terminalLines.length;

  useEffect(() => {
    if (!isTyping) return;

    const currentLine = terminalLines[lineIndex].text;

    if (charIndex < currentLine.length) {
      const timer = window.setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, TYPING_INTERVAL_MS);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setLineIndex((prev) => prev + 1);
      setCharIndex(0);
    }, LINE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isTyping, lineIndex, charIndex]);

  const visibleLines = useMemo(() => {
    return terminalLines.map((line, index) => {
      if (prefersReducedMotion || index < lineIndex) {
        return { ...line, visibleText: line.text };
      }
      if (index === lineIndex) {
        return { ...line, visibleText: line.text.slice(0, charIndex) };
      }
      return { ...line, visibleText: "" };
    });
  }, [prefersReducedMotion, lineIndex, charIndex]);

  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="CLI"
        title="Start locally in seconds."
        description="Install dependencies, run the simulate command, and talk to your agent in under a minute."
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: easeOut }}
        className="max-w-3xl mx-auto"
      >
        <MacWindow title="zsh — vox">
          <div className="p-5 sm:p-6 font-mono text-sm leading-relaxed bg-[#0b0b12]">
            <div className="space-y-2 overflow-x-auto">
              {visibleLines.map((line, index) => (
                <div
                  key={index}
                  className={`${line.color} ${line.indent ? "pl-4" : ""} whitespace-pre`}
                >
                  {line.visibleText}
                  {isTyping && index === lineIndex && <BlinkingCursor />}
                </div>
              ))}

              <div className="flex items-center gap-1 pl-4 text-teal-300">
                <span>$</span>
                {showFinalCursor && (
                  <span className="ml-1">
                    <BlinkingCursor />
                  </span>
                )}
              </div>
            </div>
          </div>
        </MacWindow>
      </motion.div>
    </section>
  );
}

export default Terminal;
