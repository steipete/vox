import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { easeOut } from "../lib/easing";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Quickstart", href: "#quickstart" },
];

function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0.315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <motion.line
        x1="0"
        y1="1"
        x2="20"
        y2="1"
        animate={{ y1: open ? 6 : 1, y2: open ? 6 : 1, rotate: open ? 45 : 0 }}
      />
      <motion.line x1="0" y1="7" x2="20" y2="7" animate={{ opacity: open ? 0 : 1 }} />
      <motion.line
        x1="0"
        y1="13"
        x2="20"
        y2="13"
        animate={{ y1: open ? 6 : 13, y2: open ? 6 : 13, rotate: open ? -45 : 0 }}
      />
    </svg>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ${
        scrolled ? "glass-strong" : "glass"
      }`}
    >
      <nav
        className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between"
        aria-label="Primary"
      >
        <a href="#" className="text-xl font-semibold tracking-tight text-gradient">
          Vox
        </a>

        <div className="flex items-center gap-1">
          <ul className="hidden md:flex items-center gap-1 mr-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-[#a1a1b6] hover:text-[#f5f5f7] transition-colors rounded-lg hover:bg-white/[0.04]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <a
            href="https://github.com/steipete/vox"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#a1a1b6] hover:text-[#f5f5f7] hover:bg-white/[0.06] transition-colors"
            aria-label="View Vox on GitHub"
          >
            <GitHubIcon size={18} />
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#a1a1b6] hover:text-[#f5f5f7] transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: easeOut }}
            className="md:hidden overflow-hidden border-t border-white/[0.08] bg-[#0b0b12]/95 backdrop-blur-xl"
          >
            <ul className="px-6 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-[#a1a1b6] hover:text-[#f5f5f7] rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/steipete/vox"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#a1a1b6] hover:text-[#f5f5f7] rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <GitHubIcon size={16} />
                  GitHub
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
