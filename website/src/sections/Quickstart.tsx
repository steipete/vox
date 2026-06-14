import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

import { MacWindow } from "../components/MacWindow";
import { SectionHeader } from "../components/SectionHeader";
import { easeOut } from "../lib/easing";

const BASH_SNIPPET = `# 1. Clone and install
git clone https://github.com/steipete/vox.git
cd vox
pnpm install

# 2. Configure env
cp .env.example .env
# Add OPENAI_API_KEY and optional VOX_AGENT_URL

# 3. Simulate a conversation
pnpm run dev -- simulate

# 4. Serve with a public URL for Twilio
pnpm run dev -- serve --port 3000`;

const ENV_SNIPPET = `OPENAI_API_KEY=sk-...
VOX_AGENT_URL=http://localhost:8000/agent
VOX_PUBLIC_BASE_URL=https://your-ngrok-url.ngrok.io
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...`;

type TokenType = "command" | "string" | "option" | "arg";

function tokenize(line: string): Array<{ type: TokenType; value: string }> {
  const tokens: Array<{ type: TokenType; value: string }> = [];
  const commands = new Set(["git", "cd", "cp", "pnpm"]);
  const regex = /[^\s"']+|"[^"]*"|'[^']*'/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(line)) !== null) {
    const value = match[0];
    let type: TokenType = "arg";

    if (index === 0 && commands.has(value)) {
      type = "command";
    } else if (value.startsWith('"') || value.startsWith("'")) {
      type = "string";
    } else if (value.startsWith("--") || /^-[a-zA-Z]+$/.test(value)) {
      type = "option";
    } else if (value.startsWith("http") || value.startsWith("https")) {
      type = "string";
    }

    tokens.push({ type, value });
    index++;
  }

  return tokens;
}

function BashLine({ line }: { line: string }) {
  if (line.trimStart().startsWith("#")) {
    return <span className="text-[#6b6b7b]">{line}</span>;
  }

  const tokens = tokenize(line);

  return (
    <>
      {tokens.map((token, i) => {
        const className =
          token.type === "command"
            ? "text-teal-300"
            : token.type === "string"
              ? "text-violet-300"
              : token.type === "option"
                ? "text-blue-300"
                : "text-[#a1a1b6]";
        return (
          <span key={i} className={className}>
            {token.value}
            {i < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
}

function EnvLine({ line }: { line: string }) {
  const eqIndex = line.indexOf("=");
  if (eqIndex === -1) return <span className="text-[#a1a1b6]">{line}</span>;

  const key = line.slice(0, eqIndex + 1);
  const value = line.slice(eqIndex + 1);
  const isUrl = value.startsWith("http");

  return (
    <>
      <span className="text-[#f5f5f7]">{key}</span>
      <span className={isUrl ? "text-violet-300" : "text-[#a1a1b6]"}>{value}</span>
    </>
  );
}

interface CodeBlockProps {
  code: string;
  highlight: (line: string) => ReactNode;
  className?: string;
}

function CodeBlock({ code, highlight, className = "" }: CodeBlockProps) {
  return (
    <pre
      className={`p-5 md:p-6 overflow-x-auto text-sm leading-relaxed font-mono text-[#a1a1b6] ${className}`}
    >
      <code>
        {code.split("\n").map((line, i) => (
          <div key={i} className="min-h-[1.5em]">
            {highlight(line)}
            {line === "" && " "}
          </div>
        ))}
      </code>
    </pre>
  );
}

export function Quickstart() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(BASH_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore unsupported clipboard environments
    }
  };

  return (
    <section id="quickstart" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Quickstart"
        title="From zero to talking in minutes."
        description="Install, simulate, then connect a real Twilio number when you're ready."
      />

      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <MacWindow title="bash — install.md" className="mac-shadow">
            <div className="relative">
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-4 right-4 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#a1a1b6] bg-white/[0.04] hover:bg-white/[0.08] hover:text-[#f5f5f7] transition-colors border border-white/[0.06] min-h-[44px] min-w-[44px]"
                aria-label="Copy quickstart commands"
              >
                {copied ? <Check size={14} className="text-teal-300" /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <CodeBlock
                code={BASH_SNIPPET}
                highlight={(line) => <BashLine line={line} />}
                className="pt-12"
              />
            </div>
          </MacWindow>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.15, ease: easeOut }}
        >
          <MacWindow title=".env.example" className="mac-shadow">
            <CodeBlock code={ENV_SNIPPET} highlight={(line) => <EnvLine line={line} />} />
          </MacWindow>
        </motion.div>
      </div>
    </section>
  );
}

export default Quickstart;
