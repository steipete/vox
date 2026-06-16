import { motion } from "framer-motion";
import { ArrowRight, GithubIcon } from "../components/icons";
import { easeOut } from "../lib/easing";

export function CTABanner() {
  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: easeOut }}
        className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl animated-border backdrop-blur-xl p-8 md:p-16 text-center"
      >
        <div className="absolute -inset-24 bg-gradient-to-r from-teal-300/10 via-violet-300/10 to-blue-300/10 blur-3xl opacity-50" />

        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#f5f5f7] mb-4">
            Ready to give your app a voice?
          </h2>
          <p className="text-lg text-[#a1a1b6] mb-8 max-w-2xl mx-auto">
            Clone Vox, run the simulator, and connect a real phone number when you're ready. No
            platform lock-in, no per-minute markup.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <a
              href="#quickstart"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#f5f5f7] text-[#05050a] font-medium text-sm hover:bg-white transition-colors"
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://github.com/steipete/vox"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg glass text-[#f5f5f7] font-medium text-sm hover:bg-white/10 transition-colors"
            >
              <GithubIcon className="w-4 h-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export default CTABanner;
