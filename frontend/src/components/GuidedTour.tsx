import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Languages,
  LayoutDashboard,
  PiggyBank,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { patchJson } from "../api/client";

interface TourStep {
  selector: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}

const steps: TourStep[] = [
  {
    selector: '[data-tour="brand"]',
    icon: <Sparkles size={22} />,
    eyebrow: "Welcome to Ravani",
    title: "Your finances, in one calm place",
    description:
      "This short tour shows where to track your month, protect savings, and understand your real financial position.",
  },
  {
    selector: '[data-tour="overview"]',
    icon: <LayoutDashboard size={22} />,
    eyebrow: "Overview",
    title: "See the important numbers first",
    description:
      "Your dashboard brings together safe-to-spend money, calculated bank balance, unpaid bills, savings progress, and trends.",
  },
  {
    selector: '[data-tour="month"]',
    icon: <WalletCards size={22} />,
    eyebrow: "Monthly workspace",
    title: "Record what actually happened",
    description:
      "Receive income, pay household bills in full or partially, add private expenses, and manage previous months here.",
  },
  {
    selector: '[data-tour="savings"]',
    icon: <PiggyBank size={22} />,
    eyebrow: "Savings goals",
    title: "Give every saved rupee a purpose",
    description:
      "Create goals, edit their targets, and move reserved money between your virtual savings envelopes.",
  },
  {
    selector: '[data-tour="reports"]',
    icon: <BarChart3 size={22} />,
    eyebrow: "Reports",
    title: "Turn activity into a clear story",
    description:
      "Follow income, spending, cash flow, and savings over time, then export reports or a complete backup.",
  },
  {
    selector: '[data-tour="language"]',
    icon: <Languages size={22} />,
    eyebrow: "Your preferences",
    title: "Make the app feel like yours",
    description:
      "Switch between English and Urdu anytime. You can replay this tour later from the question-mark button.",
  },
];

export function GuidedTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<CSSProperties | null>(null);
  const step = steps[stepIndex];
  const finish = useMutation({
    mutationFn: () => patchJson("/preferences/", { tour_completed: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish.mutate();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const updateSpotlight = () => {
      const target = document.querySelector<HTMLElement>(step.selector);
      if (!target) {
        setSpotlight(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        rect.right <= 0 ||
        rect.left >= window.innerWidth ||
        rect.bottom <= 0 ||
        rect.top >= window.innerHeight
      ) {
        setSpotlight(null);
        return;
      }
      const padding = 7;
      setSpotlight({
        top: Math.max(rect.top - padding, 6),
        left: Math.max(rect.left - padding, 6),
        width: Math.min(rect.width + padding * 2, window.innerWidth - 12),
        height: Math.min(rect.height + padding * 2, window.innerHeight - 12),
      });
    };
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [open, step]);

  if (!open) return null;

  const isLastStep = stepIndex === steps.length - 1;
  return (
    <div className="guided-tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className={`tour-shade ${spotlight ? "with-spotlight" : ""}`} />
      {spotlight && <div className="tour-spotlight" style={spotlight} />}
      <section className="tour-card">
        <div className="tour-card-top">
          <span className="tour-step-icon">{step.icon}</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Skip guided tour"
            disabled={finish.isPending}
            onClick={() => finish.mutate()}
          >
            <X size={17} />
          </button>
        </div>
        <span className="tour-eyebrow">{step.eyebrow}</span>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.description}</p>
        <div className="tour-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
          {steps.map((item, index) => (
            <span
              className={index <= stepIndex ? "active" : ""}
              key={item.title}
            />
          ))}
        </div>
        <div className="tour-actions">
          <button
            className="button secondary"
            type="button"
            disabled={stepIndex === 0 || finish.isPending}
            onClick={() => setStepIndex((current) => current - 1)}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            className="button primary"
            type="button"
            disabled={finish.isPending}
            onClick={() =>
              isLastStep
                ? finish.mutate()
                : setStepIndex((current) => current + 1)
            }
          >
            {isLastStep ? "Finish tour" : "Next"}
            {!isLastStep && <ChevronRight size={16} />}
          </button>
        </div>
        {finish.isError && (
          <p className="form-error">We couldn’t save your tour progress. Please try again.</p>
        )}
      </section>
    </div>
  );
}
