const FOOTER_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Quickstart", href: "#quickstart" },
  { label: "GitHub", href: "https://github.com/steipete/vox" },
];

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer className={`border-t border-white/[0.08] px-6 py-12 ${className ?? ""}`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <a href="#" className="text-2xl font-semibold tracking-tight text-gradient">
          Vox
        </a>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
            {FOOTER_LINKS.map((link) => {
              const isExternal = link.href.startsWith("http");

              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noreferrer" : undefined}
                    className="inline-block py-3 px-2 text-sm font-medium text-[#a1a1b6] hover:text-[#f5f5f7] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <p className="text-sm text-[#a1a1b6] text-center md:text-right">
          MIT License · Built by Peter Steinberger and contributors
        </p>
      </div>
    </footer>
  );
}

export default Footer;
