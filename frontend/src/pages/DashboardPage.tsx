import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarPlus,
  CircleAlert,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ApiError, api, appLocale, formatPkr, money } from "../api/client";
import { EmptyState, ErrorPanel, MetricCard, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import type { Dashboard, Trend } from "../types";

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard/"),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const trends = useQuery({
    queryKey: ["trends"],
    queryFn: () => api<{ results: Trend[] }>("/reports/trends/"),
  });

  if (dashboard.isLoading) {
    return (
      <>
        <PageHeader title="Your financial home" description="Loading this month’s plan…" />
        <div className="metric-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} height={140} />
          ))}
        </div>
      </>
    );
  }
  if (dashboard.isError || !dashboard.data) {
    if (dashboard.error instanceof ApiError && dashboard.error.status === 404) {
      return (
        <>
          <PageHeader
            eyebrow="Overview"
            title="No active month yet"
            description="Your overview will appear as soon as you add or restore a monthly workspace."
            actions={
              <Link className="button primary" to="/app/month">
                <CalendarPlus size={17} /> Add month
              </Link>
            }
          />
          <section className="panel">
            <EmptyState
              icon={<CalendarPlus size={24} />}
              title="Start with a month"
              description="Create a month to track income, household bills, personal spending, savings, and bank activity."
              action={
                <Link className="button primary" to="/app/month">
                  Open monthly workspace <ArrowRight size={17} />
                </Link>
              }
            />
          </section>
        </>
      );
    }
    return <ErrorPanel message="Please refresh or try again shortly." />;
  }

  const data = dashboard.data;
  const savingsProgress =
    money(data.period.savings_target) > 0
      ? (money(data.period.net_new_savings) / money(data.period.savings_target)) * 100
      : 0;
  const chartData = (trends.data?.results ?? []).map((row) => ({
    name: new Date(row.year, row.month - 1).toLocaleDateString(appLocale(), {
      month: "short",
    }),
    income: money(row.income_received),
    expenses: money(row.household_paid) + money(row.personal_spent),
  }));

  return (
    <>
      <PageHeader
        eyebrow={new Date(data.period.year, data.period.month - 1).toLocaleDateString(
          appLocale(),
          { month: "long", year: "numeric" },
        )}
        title="Your financial home"
        description="A clear view of what is safe to spend, what is reserved, and what is actually in the bank."
        actions={
          <Link className="button primary" to="/app/month">
            Open month <ArrowRight size={17} />
          </Link>
        }
      />

      <section className="metric-grid">
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

      {data.bank.variance !== null && money(data.bank.variance) !== 0 && (
        <div className="callout warning">
          <CircleAlert size={19} />
          <div>
            <strong>Your bank needs reconciliation</strong>
            <span>
              The last actual balance differs by {formatPkr(data.bank.variance)}.
            </span>
          </div>
          <Link to="/app/settings">Review</Link>
        </div>
      )}

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Cash flow</span>
              <h2>Income versus spending</h2>
            </div>
            <Link to="/app/reports">Full report</Link>
          </div>
          {chartData.length > 0 ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(value) => formatPkr(value)} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#income)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#expense)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles size={22} />}
              title="Your trend begins here"
              description="Record income and payments to build a useful month-over-month picture."
            />
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Savings target</span>
              <h2>{formatPkr(data.period.net_new_savings)} saved</h2>
            </div>
            <span className="percent-pill">{Math.max(0, savingsProgress).toFixed(0)}%</span>
          </div>
          <ProgressBar
            value={money(data.period.net_new_savings)}
            max={money(data.period.savings_target)}
          />
          <div className="goal-list">
            {data.savings.goals.slice(0, 4).map((goal) => (
              <div className="goal-row" key={goal.id}>
                <span className="goal-dot" />
                <div>
                  <strong>{goal.name}</strong>
                  <small>
                    {goal.target_amount
                      ? `${formatPkr(goal.balance)} of ${formatPkr(goal.target_amount)}`
                      : "No target set"}
                  </small>
                </div>
                <b>{formatPkr(goal.balance, true)}</b>
              </div>
            ))}
          </div>
          <Link className="text-link" to="/app/savings">
            Manage savings <ArrowRight size={15} />
          </Link>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Household plan</span>
            <h2>Bills still waiting</h2>
          </div>
          <span className="count-pill">{data.unpaid_bills.length}</span>
        </div>
        {data.unpaid_bills.length ? (
          <div className="bill-list">
            {data.unpaid_bills.slice(0, 5).map((bill) => (
              <div className="bill-row" key={bill.id}>
                <span className={`status-icon ${bill.status}`}>
                  <Wallet size={18} />
                </span>
                <div>
                  <strong>{bill.name}</strong>
                  <small>
                    Due {new Date(`${bill.due_date}T00:00:00`).toLocaleDateString(appLocale(), {
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                </div>
                <div className="bill-amount">
                  <strong>{formatPkr(bill.remaining_amount)}</strong>
                  <small>{bill.status}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="Everything is covered"
            description="There are no unpaid household bills in this month."
          />
        )}
      </section>
    </>
  );
}
