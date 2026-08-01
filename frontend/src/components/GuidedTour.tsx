import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Languages,
  LayoutDashboard,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { patchJson } from "../api/client";

interface TourStep {
  selector?: string;
  path?: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  details: string[];
  ownerOnly?: boolean;
  centered?: boolean;
}

const allSteps: TourStep[] = [
  {
    icon: <Sparkles size={22} />,
    eyebrow: "Welcome to Ravani",
    title: "Your monthly money has a clear flow now",
    description:
      "Ravani turns your salary, household commitments, personal spending, savings, and real bank balance into one connected monthly plan.",
    details: [
      "Record what actually happened instead of replacing your original plan.",
      "This walkthrough will open each important area and show you what to do there.",
    ],
    centered: true,
  },
  {
    selector: '[data-tour="overview"]',
    path: "/app",
    icon: <LayoutDashboard size={22} />,
    eyebrow: "Overview",
    title: "Begin each visit with the big picture",
    description:
      "Overview is your financial home screen. It answers what is available, reserved, unpaid, and reflected in the bank.",
    details: [
      "Use Open month when you need to record new activity.",
      "The left navigation takes you to every workspace; on mobile, open it with the menu button.",
    ],
  },
  {
    selector: '[data-tour="dashboard-summary"]',
    path: "/app",
    icon: <ShieldCheck size={22} />,
    eyebrow: "Dashboard summary",
    title: "Read these four numbers together",
    description:
      "Safe to spend is what remains after planned bills, savings, and personal spending. Calculated bank is built from recorded cash flow.",
    details: [
      "House balance shows household obligations still unpaid.",
      "Savings reserved is money still in your bank but protected inside savings goals.",
    ],
  },
  {
    selector: '[data-tour="dashboard-insights"]',
    path: "/app",
    icon: <BarChart3 size={22} />,
    eyebrow: "Monthly health",
    title: "Spot trends and unfinished work",
    description:
      "The dashboard compares income with spending, tracks progress toward this month’s savings target, and lists bills still waiting.",
    details: [
      "A reconciliation warning means Ravani’s calculated balance differs from the balance you entered from your bank.",
      "These cards update automatically whenever you record or edit a transaction.",
    ],
  },
  {
    selector: '[data-tour="month"]',
    path: "/app/month",
    icon: <WalletCards size={22} />,
    eyebrow: "Monthly workspace",
    title: "This is where the month is recorded",
    description:
      "Choose any existing month, add a current or previous month, and record income, bills, savings allocations, and private expenses.",
    details: [
      "Recurring income and bills are copied into a month as a plan; only recorded payments affect cash flow.",
      "When creating the next month, Ravani helps distribute eligible leftovers and unpaid amounts.",
    ],
  },
  {
    selector: '[data-tour="month-summary"]',
    path: "/app/month",
    icon: <ListChecks size={22} />,
    eyebrow: "Plan and progress",
    title: "Compare the plan with what was paid",
    description:
      "The monthly summary shows the household plan, total paid, completion progress, and fixed savings target for the selected month.",
    details: [
      "Use Receive beside an income source only when money reaches your bank.",
      "Use Add payment beside a bill; partial and overpayments are supported and unpaid amounts remain visible.",
    ],
  },
  {
    selector: '[data-tour="planned-obligations"]',
    path: "/app/month",
    icon: <ReceiptText size={22} />,
    eyebrow: "Planned obligations",
    title: "Track every household expense against its plan",
    description:
      "The Household expenses table keeps the expected amount, due date, paid amount, unpaid balance, and current payment status together.",
    details: [
      "Use Add payment to record a full, partial, or overpayment without changing the original expectation.",
      "Unpaid amounts stay visible, while eligible overpayments can be carried into the following month.",
    ],
  },
  {
    selector: '[data-tour="month-transactions"]',
    path: "/app/month",
    icon: <ReceiptText size={22} />,
    eyebrow: "Shared transactions",
    title: "Your actual household cash movements live here",
    description:
      "Received income, household payments, and reconciliation adjustments appear in the shared transaction history.",
    details: [
      "Edit an entry to correct its date, amount, or notes; delete it if it should not exist.",
      "Every correction immediately recalculates the dashboard, bank balance, and reports.",
    ],
    ownerOnly: true,
  },
  {
    selector: '[data-tour="personal-expenses"]',
    path: "/app/month",
    icon: <CircleUserRound size={22} />,
    eyebrow: "Private spending",
    title: "Personal expense details stay private",
    description:
      "Add your own day-to-day spending from the monthly workspace, then edit or delete it from Your personal expenses.",
    details: [
      "Other members cannot see your descriptions, notes, or individual entries.",
      "The household dashboard uses only an anonymous combined personal-spending total.",
    ],
  },
  {
    selector: '[data-tour="savings-overview"]',
    path: "/app/savings",
    icon: <PiggyBank size={22} />,
    eyebrow: "Savings goals",
    title: "Give protected money a purpose",
    description:
      "Household owners create goals such as Emergency Fund or Travel, set optional targets, and edit a goal without rewriting its history.",
    details: [
      "Owners use Add movement to record a contribution, withdrawal, allocation, or transfer.",
      "Transfers and monthly allocations move money internally; external contributions and withdrawals also affect calculated bank.",
    ],
  },
  {
    selector: '[data-tour="savings-buckets"]',
    path: "/app/savings",
    icon: <PiggyBank size={22} />,
    eyebrow: "Savings buckets",
    title: "See how your reserved money is distributed",
    description:
      "Each savings bucket shows its current reserved balance, optional target, progress, and how much remains to reach that target.",
    details: [
      "Use separate buckets for purposes such as emergencies, travel, education, gifts, or family goals.",
      "Editing a bucket changes its name, target, or active status; use a savings movement when the balance itself changes.",
    ],
  },
  {
    selector: '[data-tour="savings-ledger"]',
    path: "/app/savings",
    icon: <ListChecks size={22} />,
    eyebrow: "Savings history",
    title: "See every savings credit and debit",
    description:
      "The savings ledger explains how each goal balance changed, including the source, destination, movement type, amount, and date.",
    details: [
      "Filter the ledger by one goal when you need its complete story.",
      "Transfers appear as both a debit from one goal and a credit to another without changing total bank cash.",
    ],
  },
  {
    selector: '[data-tour="reports"]',
    path: "/app/reports",
    icon: <BarChart3 size={22} />,
    eyebrow: "Reports and exports",
    title: "Understand progress across months",
    description:
      "Reports compare income, household expenses, personal spending, net cash flow, and savings growth month by month.",
    details: [
      "Download CSV when you want a spreadsheet-friendly ledger.",
      "Household owners can download the explicit full JSON backup for safekeeping.",
    ],
  },
  {
    selector: '[data-tour="notifications"]',
    path: "/app/notifications",
    icon: <Bell size={22} />,
    eyebrow: "Notifications",
    title: "Keep bills and savings from slipping",
    description:
      "Due-date, overdue-bill, and savings-target reminders are collected here and can take you directly to the relevant action.",
    details: [
      "Owners receive reminders for shared household finances.",
      "Use Mark all read after reviewing the latest items.",
    ],
  },
  {
    selector: '[data-tour="settings-bank"]',
    path: "/app/settings",
    icon: <Building2 size={22} />,
    eyebrow: "Bank and household settings",
    title: "Keep the plan aligned with real life",
    description:
      "Settings holds the tracked bank account, household savings target, and the tools that define future monthly plans.",
    details: [
      "Reconcile by entering the actual balance shown by your bank; Ravani will show any variance.",
      "A bank adjustment is recorded only when you explicitly choose to post one.",
    ],
  },
  {
    selector: '[data-tour="settings-recurring"]',
    path: "/app/settings",
    icon: <Settings size={22} />,
    eyebrow: "Recurring plan and access",
    title: "Manage what future months inherit",
    description:
      "Edit recurring income sources and household bills here. Changes update the latest month and become the defaults for future months.",
    details: [
      "Bill settings include the expected amount, due day, and reminder lead time.",
      "Household owners can also invite members using their exact verified Google email.",
    ],
    ownerOnly: true,
  },
  {
    selector: '[data-tour="account"]',
    path: "/app/account",
    icon: <CircleUserRound size={22} />,
    eyebrow: "Your account",
    title: "Review membership and account controls",
    description:
      "Account shows your signed-in identity, household role, privacy boundaries, and account-management actions.",
    details: [
      "Members manage only their own private spending while shared finances remain owner-controlled.",
      "Permanent actions such as leaving a household or deleting an account are kept here.",
    ],
  },
  {
    selector: '[data-tour="preferences"]',
    icon: <Languages size={22} />,
    eyebrow: "Language, theme, and help",
    title: "Make Ravani comfortable to use",
    description:
      "Use the top bar to switch between English and Urdu, change light or dark mode, or open this detailed tour again.",
    details: [
      "Your language preference is saved to your account for future visits.",
      "The question-mark button restarts this walkthrough whenever you need a refresher.",
    ],
  },
  {
    icon: <Sparkles size={22} />,
    eyebrow: "You’re ready",
    title: "Follow the flow one transaction at a time",
    description:
      "Start in This month, record money only when it actually moves, reserve savings with a purpose, and use Overview to check the result.",
    details: [
      "You can return to any previous month to correct its complete financial flow.",
      "Replay this tour anytime from the question-mark button in the top bar.",
    ],
    centered: true,
  },
];

const mobileNavigationSelectors = new Set([
  '[data-tour="overview"]',
  '[data-tour="month"]',
  '[data-tour="account"]',
]);

export function GuidedTour({
  open,
  onClose,
  isOwner = false,
  onMobileNavigationChange,
}: {
  open: boolean;
  onClose: () => void;
  isOwner?: boolean;
  onMobileNavigationChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const cardRef = useRef<HTMLElement>(null);
  const steps = useMemo(
    () => allSteps.filter((step) => !step.ownerOnly || isOwner),
    [isOwner],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<CSSProperties | null>(null);
  const [cardAtTop, setCardAtTop] = useState(false);
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
    setSpotlight(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish.mutate();
      if (event.key === "ArrowRight" && stepIndex < steps.length - 1) {
        setStepIndex((current) => current + 1);
      }
      if (event.key === "ArrowLeft" && stepIndex > 0) {
        setStepIndex((current) => current - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, stepIndex, steps.length]);

  useEffect(() => {
    if (!open || !step.path || location.pathname === step.path) return;
    navigate(step.path);
  }, [location.pathname, navigate, open, step.path]);

  useEffect(() => {
    const showNavigation = Boolean(
      open && step.selector && mobileNavigationSelectors.has(step.selector),
    );
    onMobileNavigationChange?.(showNavigation);
    return () => onMobileNavigationChange?.(false);
  }, [onMobileNavigationChange, open, step.selector]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open || !step.selector) {
      setSpotlight(null);
      setCardAtTop(false);
      return;
    }

    let attempts = 0;
    let attemptedScroll = false;
    let positionedForMobile = false;
    let retryTimer: number | undefined;
    let scrollFrame: number | undefined;
    const updateSpotlight = () => {
      const target = document.querySelector<HTMLElement>(step.selector!);
      if (!target) {
        setSpotlight(null);
        if (attempts < 20) {
          attempts += 1;
          retryTimer = window.setTimeout(updateSpotlight, 100);
        }
        return;
      }

      let rect = target.getBoundingClientRect();
      const isMobile = window.matchMedia("(max-width: 880px)").matches;
      const isMobileNavigation = mobileNavigationSelectors.has(step.selector!);
      const outsideViewport =
        rect.right <= 0 ||
        rect.left >= window.innerWidth ||
        rect.bottom <= 0 ||
        rect.top >= window.innerHeight;
      if (
        outsideViewport &&
        !isMobileNavigation &&
        !attemptedScroll &&
        typeof target.scrollIntoView === "function"
      ) {
        attemptedScroll = true;
        target.scrollIntoView({ block: "center", inline: "nearest" });
        scrollFrame = window.requestAnimationFrame(updateSpotlight);
        return;
      }

      if (outsideViewport && isMobileNavigation && attempts < 12) {
        attempts += 1;
        retryTimer = window.setTimeout(updateSpotlight, 50);
        return;
      }

      if (
        isMobile &&
        !isMobileNavigation &&
        !positionedForMobile &&
        typeof target.scrollIntoView === "function"
      ) {
        positionedForMobile = true;
        target.scrollIntoView({ block: "start", inline: "nearest" });
        scrollFrame = window.requestAnimationFrame(updateSpotlight);
        return;
      }
      if (outsideViewport) {
        setSpotlight(null);
        return;
      }
      if (!rect.width || !rect.height) {
        setSpotlight(null);
        return;
      }

      rect = target.getBoundingClientRect();
      const padding = 8;
      const placeCardAtTop = isMobile
        ? rect.top > window.innerHeight * 0.5
        : rect.top + rect.height / 2 > window.innerHeight * 0.58;
      const cardSpace = isMobile
        ? Math.min(cardRef.current?.getBoundingClientRect().height ?? 340, window.innerHeight * 0.48) + 28
        : 0;
      const visibleTop = isMobile && placeCardAtTop ? cardSpace : 6;
      const visibleBottom =
        isMobile && !placeCardAtTop
          ? window.innerHeight - cardSpace
          : window.innerHeight - 6;
      const left = Math.max(rect.left - padding, 6);
      const top = Math.max(rect.top - padding, visibleTop);
      const bottom = Math.min(rect.bottom + padding, visibleBottom);
      if (bottom <= top) {
        setSpotlight(null);
        setCardAtTop(placeCardAtTop);
        return;
      }
      setSpotlight({
        top,
        left,
        width: Math.min(rect.width + padding * 2, window.innerWidth - left - 6),
        height: bottom - top,
      });
      setCardAtTop(placeCardAtTop);
    };

    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [location.pathname, open, step.selector]);

  if (!open) return null;

  const isLastStep = stepIndex === steps.length - 1;
  const progress = ((stepIndex + 1) / steps.length) * 100;
  return (
    <div className="guided-tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className={`tour-shade ${spotlight ? "with-spotlight" : ""}`} />
      {spotlight && <div className="tour-spotlight" style={spotlight} />}
      <section
        className={`tour-card ${step.centered ? "centered" : ""} ${cardAtTop ? "at-top" : ""}`}
        ref={cardRef}
        tabIndex={-1}
      >
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
        <div className="tour-step-meta">
          <span className="tour-eyebrow">{step.eyebrow}</span>
          <span>Step {stepIndex + 1} of {steps.length}</span>
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.description}</p>
        <ul className="tour-details">
          {step.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
        <div className="tour-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
          <span style={{ width: `${progress}%` }} />
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
