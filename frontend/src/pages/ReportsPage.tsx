import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileJson,
  LineChart as LineChartIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, formatPkr, money } from "../api/client";
import { EmptyState, ErrorPanel, PageHeader, Skeleton } from "../components/ui";
import type { Trend } from "../types";

export function ReportsPage() {
  const query = useQuery({
    queryKey: ["trends"],
    queryFn: () => api<{ results: Trend[] }>("/reports/trends/"),
  });
  if (query.isLoading) return <Skeleton height={500} />;
  if (query.isError || !query.data) return <ErrorPanel />;

  const rows = query.data.results.map((row) => ({
    ...row,
    name: new Date(row.year, row.month - 1).toLocaleDateString("en-PK", {
      month: "short",
      year: "2-digit",
    }),
    income: money(row.income_received),
    household: money(row.household_paid),
    personal: money(row.personal_spent),
    savings: money(row.savings_total),
    cashFlow: money(row.net_cash_flow),
  }));
  const latest = rows.at(-1);

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Turn monthly habits into a clear story"
        description="Compare what came in, where it went, and how much stayed protected."
        actions={
          <>
            <a className="button secondary" href="/api/v1/exports/ledger.csv">
              <Download size={17} /> CSV
            </a>
            <a className="button primary" href="/api/v1/exports/backup.json">
              <FileJson size={17} /> Full backup
            </a>
          </>
        }
      />

      {rows.length ? (
        <>
          <section className="report-highlights">
            <article>
              <span className="report-icon positive">
                <TrendingUp size={19} />
              </span>
              <div>
                <small>Latest income</small>
                <strong>{formatPkr(latest?.income)}</strong>
              </div>
            </article>
            <article>
              <span className="report-icon negative">
                <TrendingDown size={19} />
              </span>
              <div>
                <small>Latest spending</small>
                <strong>
                  {formatPkr((latest?.household ?? 0) + (latest?.personal ?? 0))}
                </strong>
              </div>
            </article>
            <article>
              <span className="report-icon neutral">
                <LineChartIcon size={19} />
              </span>
              <div>
                <small>Net cash flow</small>
                <strong>{formatPkr(latest?.cashFlow)}</strong>
              </div>
            </article>
          </section>

          <section className="panel report-chart">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Spending mix</span>
                <h2>Income and expenses by month</h2>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={rows} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => formatPkr(value)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar
                  dataKey="household"
                  name="Household"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="personal"
                  name="Personal"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="panel report-chart">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Protected money</span>
                <h2>Savings growth</h2>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rows}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => formatPkr(value)} />
                <Line
                  dataKey="savings"
                  name="Savings"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: "#10b981", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </>
      ) : (
        <EmptyState
          icon={<LineChartIcon size={24} />}
          title="Reports begin after your first transaction"
          description="Your income, expenses, cash flow, and savings trends will appear here automatically."
        />
      )}
    </>
  );
}
