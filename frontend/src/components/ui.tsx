import clsx from "clsx";
import type { ReactNode } from "react";
import { formatPkr, money } from "../api/client";

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: unknown;
  hint?: string;
  icon: ReactNode;
  tone?: "indigo" | "emerald" | "amber" | "slate";
}) {
  const negative = money(value) < 0;
  return (
    <article className={clsx("metric-card", `tone-${tone}`)}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong className={negative ? "negative" : ""}>{formatPkr(value)}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </article>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "emerald",
}: {
  value: number;
  max: number;
  tone?: "emerald" | "indigo";
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const accessibleValue = Math.min(Math.max(value, 0), max);
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={accessibleValue}
    >
      <span
        className={`progress-fill ${tone}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function Skeleton({ height = 120 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}

export function ErrorPanel({ message = "Something went wrong." }: { message?: string }) {
  return (
    <div className="error-panel" role="alert">
      <strong>We couldn’t load this section.</strong>
      <span>{message}</span>
    </div>
  );
}
