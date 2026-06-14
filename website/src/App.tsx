import { useEffect, useState } from "react";
import Lenis from "lenis";
import { motion, AnimatePresence, useReducedMotion, useScroll, useSpring } from "framer-motion";

import { easeOut } from "./lib/easing";
import Preloader from "./components/Preloader";
import Navbar from "./components/Navbar";
import Dock from "./components/Dock";
import Hero from "./sections/Hero";
import Highlights from "./sections/Highlights";
import Terminal from "./sections/Terminal";
import Features from "./sections/Features";
import Architecture from "./sections/Architecture";
import Quickstart from "./sections/Quickstart";
import UseCases from "./sections/UseCases";
import CTABanner from "./sections/CTABanner";
import Footer from "./sections/Footer";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const displayDuration = prefersReducedMotion ? 300 : 1500;
    let timer: ReturnType<typeof setTimeout>;

    const finishLoading = () => {
      timer = setTimeout(() => setIsLoading(false), displayDuration);
    };

    if (document.readyState === "complete") {
      finishLoading();
    } else {
      window.addEventListener("load", finishLoading);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", finishLoading);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const fadeDuration = prefersReducedMotion ? 0.3 : 0.6;

  return (
    <div className="relative min-h-screen">
      <AnimatePresence mode="wait">{isLoading && <Preloader key="preloader" />}</AnimatePresence>

      <div className="aurora" />
      <div className="grid-pattern" />
      <div className="noise-overlay" />

      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400 via-violet-400 to-blue-400 origin-left z-50"
        style={{ scaleX }}
      />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[70] px-4 py-2 rounded-lg bg-[#f5f5f7] text-[#05050a] text-sm font-medium"
      >
        Skip to content
      </a>

      <Navbar />

      <motion.main
        id="main-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: fadeDuration, ease: easeOut }}
      >
        <Hero />
        <Highlights />
        <Terminal />
        <Features />
        <Architecture />
        <Quickstart />
        <UseCases />
        <CTABanner />
      </motion.main>

      <Dock />
      <Footer className="pb-28" />
    </div>
  );
}

export default App;
