import { FlaskConical, Headset, TrendingUp, Workflow } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { SpotlightCard } from "../components/SpotlightCard";

const USE_CASES = [
  {
    icon: Headset,
    title: "Customer support",
    description:
      "Deflect repetitive calls with a voice agent that can look up orders, reset passwords, and escalate to humans.",
    accent: "teal",
  },
  {
    icon: Workflow,
    title: "Operations",
    description:
      "Confirm appointments, dispatch field teams, or collect structured data over the phone via agent tool calls.",
    accent: "violet",
  },
  {
    icon: TrendingUp,
    title: "Sales",
    description:
      "Qualify leads with natural voice conversations, book meetings, and log outcomes to your CRM.",
    accent: "blue",
  },
  {
    icon: FlaskConical,
    title: "Prototyping",
    description:
      "Test prompts and tool integrations in `vox simulate` without Twilio credentials or call charges.",
    accent: "teal",
  },
];

const ICON_CLASSES: Record<string, string> = {
  teal: "text-teal-300 from-teal-300/15",
  violet: "text-violet-300 from-violet-300/15",
  blue: "text-blue-300 from-blue-300/15",
};

export function UseCases() {
  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Use cases"
          title="Built for builders."
          description="Self-hosted voice agents for support, operations, sales, and prototypes."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {USE_CASES.map((useCase) => {
            const Icon = useCase.icon;
            const iconClass = ICON_CLASSES[useCase.accent];

            return (
              <SpotlightCard
                key={useCase.title}
                className="p-6 md:p-8"
                glowColor={
                  useCase.accent === "violet"
                    ? "rgba(167, 139, 250, 0.15)"
                    : useCase.accent === "blue"
                      ? "rgba(96, 165, 250, 0.15)"
                      : "rgba(94, 234, 212, 0.15)"
                }
              >
                <div className="flex flex-col">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconClass} to-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-5`}
                  >
                    <Icon size={22} strokeWidth={1.5} />
                  </div>

                  <h3 className="text-xl font-semibold text-[#f5f5f7] mb-3">{useCase.title}</h3>
                  <p className="text-[#a1a1b6] leading-relaxed">{useCase.description}</p>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default UseCases;
