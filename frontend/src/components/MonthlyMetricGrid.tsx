import { Landmark, PiggyBank, ReceiptText, ShieldCheck } from "lucide-react";
import { formatPkr, money } from "../api/client";
import type { Dashboard } from "../types";
import { MetricCard } from "./ui";

export function MonthlyMetricGrid({
  data,
  dataTour,
}: {
  data: Dashboard;
  dataTour?: string;
}) {
  const savingsProgress =
    money(data.period.savings_target) > 0
      ? (money(data.period.net_new_savings) / money(data.period.savings_target)) * 100
      : 0;

  return (
    <section className="metric-grid" data-tour={dataTour} aria-label="Monthly financial summary">
      <MetricCard
        label="Safe to spend"
        value={data.period.safe_to_spend}
        hint="After planned bills and savings"
        icon={<ShieldCheck size={22} />}
        tone="emerald"
      />
      <MetricCard
        label="Calculated bank"
        value={data.bank.calculated_balance}
        hint="Opening balance plus recorded cash flow"
        icon={<Landmark size={22} />}
      />
      <MetricCard
        label="House balance"
        value={data.period.house_balance}
        hint={`${formatPkr(data.period.household_paid)} paid so far`}
        icon={<ReceiptText size={22} />}
        tone="amber"
      />
      <MetricCard
        label="Savings reserved"
        value={data.savings.total}
        hint={`${Math.max(0, savingsProgress).toFixed(0)}% of this month’s target`}
        icon={<PiggyBank size={22} />}
        tone="slate"
      />
    </section>
  );
}
