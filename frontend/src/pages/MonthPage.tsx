import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  CircleDollarSign,
  LockKeyhole,
  Plus,
  Receipt,
  WalletCards,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api, formatPkr, money, postJson } from "../api/client";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorPanel, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import type { Month, Paginated, Session } from "../types";

interface PersonalExpense {
  id: number;
  period: number;
  date: string;
  amount: number | string;
  description: string;
  notes: string;
}

export function MonthPage() {
  const { session } = useOutletContext<{ session: Session }>();
  const { label } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentTarget, setPaymentTarget] = useState<number | null>(null);
  const [incomeTarget, setIncomeTarget] = useState<number | null>(null);
  const [personalOpen, setPersonalOpen] = useState(false);
  const month = useQuery({
    queryKey: ["month", label ?? "current"],
    queryFn: () =>
      api<Month>(label ? `/months/by-label/?month=${encodeURIComponent(label)}` : "/months/current/"),
  });
  const months = useQuery({
    queryKey: ["months"],
    queryFn: () => api<Paginated<Month>>("/months/"),
  });
  const personal = useQuery({
    queryKey: ["personal-expenses"],
    queryFn: () => api<Paginated<PersonalExpense>>("/personal-expenses/"),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["month"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["personal-expenses"] }),
    ]);
  };

  if (month.isLoading) return <Skeleton height={520} />;
  if (month.isError || !month.data) return <ErrorPanel />;
  const data = month.data;

  const plannedTotal = data.planned_expenses.reduce(
    (sum, item) => sum + money(item.expected_amount),
    0,
  );
  const paidTotal = data.planned_expenses.reduce(
    (sum, item) => sum + money(item.paid_amount),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Monthly workspace"
        title={new Date(data.year, data.month - 1).toLocaleDateString("en-PK", {
          month: "long",
          year: "numeric",
        })}
        description="Track what was planned and record only what actually moved through your bank."
        actions={
          <div className="inline-actions">
            <label className="month-picker">
              <span className="sr-only">Choose month</span>
              <select
                value={data.label}
                onChange={(event) => navigate(`/app/month/${event.target.value}`)}
              >
                {(months.data?.results ?? [data]).map((period) => (
                  <option key={period.id} value={period.label}>
                    {new Date(period.year, period.month - 1).toLocaleDateString("en-PK", {
                      month: "long",
                      year: "numeric",
                    })}
                  </option>
                ))}
              </select>
            </label>
            <Modal
            title="Add a private expense"
            description="Only you can see the entry details. The household sees an anonymous combined total."
            trigger={
              <button className="button primary">
                <Plus size={17} /> Personal expense
              </button>
            }
            open={personalOpen}
            onOpenChange={setPersonalOpen}
          >
            <PersonalExpenseForm
              period={data.id}
              defaultDate={`${data.label}-01`}
              onSaved={async () => {
                setPersonalOpen(false);
                await refresh();
              }}
            />
            </Modal>
          </div>
        }
      />

      <section className="month-summary">
        <div>
          <span>Household plan</span>
          <strong>{formatPkr(plannedTotal)}</strong>
          <small>{formatPkr(paidTotal)} paid</small>
        </div>
        <div className="month-summary-progress">
          <ProgressBar value={paidTotal} max={plannedTotal} tone="indigo" />
          <span>
            {plannedTotal ? Math.min((paidTotal / plannedTotal) * 100, 100).toFixed(0) : 0}%
            complete
          </span>
        </div>
        <div>
          <span>Savings target</span>
          <strong>{formatPkr(data.savings_target)}</strong>
          <small>Reserved before personal spending</small>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Money in</span>
              <h2>Income</h2>
            </div>
            <CircleDollarSign size={20} className="muted-icon" />
          </div>
          <div className="workspace-list">
            {data.income_plans.map((income) => {
              const complete = money(income.received_amount) >= money(income.planned_amount);
              return (
                <div className="workspace-row" key={income.id}>
                  <span className={`status-check ${complete ? "complete" : ""}`}>
                    {complete ? <Check size={15} /> : <ArrowDownToLine size={15} />}
                  </span>
                  <div>
                    <strong>{income.name}</strong>
                    <small>
                      {formatPkr(income.received_amount)} of {formatPkr(income.planned_amount)}
                    </small>
                  </div>
                  {session.is_owner && (
                    <button
                      className="button small secondary"
                      onClick={() => setIncomeTarget(income.id)}
                    >
                      Receive
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Planned obligations</span>
              <h2>Household expenses</h2>
            </div>
            {!session.is_owner && (
              <span className="privacy-pill">
                <LockKeyhole size={14} /> Owner managed
              </span>
            )}
          </div>
          <div className="expense-table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Due</th>
                  <th>Expected</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.planned_expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <strong>{expense.name}</strong>
                    </td>
                    <td>
                      <CalendarDays size={14} />
                      {new Date(`${expense.due_date}T00:00:00`).toLocaleDateString(
                        "en-PK",
                        { day: "numeric", month: "short" },
                      )}
                    </td>
                    <td>{formatPkr(expense.expected_amount)}</td>
                    <td>{formatPkr(expense.paid_amount)}</td>
                    <td>
                      <span className={`status-chip ${expense.status}`}>
                        {expense.status}
                      </span>
                    </td>
                    <td>
                      {session.is_owner && (
                        <button
                          className="table-action"
                          onClick={() => setPaymentTarget(expense.id)}
                        >
                          Add payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Private by design</span>
            <h2>Your personal expenses</h2>
          </div>
          <span className="privacy-pill">
            <LockKeyhole size={14} /> Only visible to you
          </span>
        </div>
        {personal.data?.results.length ? (
          <div className="personal-grid">
            {personal.data.results
              .filter((item) => item.period === data.id)
              .map((item) => (
                <div className="personal-card" key={item.id}>
                  <span>
                    <Receipt size={17} />
                  </span>
                  <div>
                    <strong>{item.description}</strong>
                    <small>{new Date(`${item.date}T00:00:00`).toLocaleDateString()}</small>
                  </div>
                  <b>{formatPkr(item.amount)}</b>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState
            icon={<WalletCards size={23} />}
            title="No personal spending yet"
            description="Add an expense when it happens; details remain private to your account."
          />
        )}
      </section>

      <Modal
        title="Record a household payment"
        description="Partial payments are supported and the remaining balance updates automatically."
        trigger={<span />}
        open={paymentTarget !== null}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
      >
        {paymentTarget && (
          <MoneyMovementForm
            label="Payment amount"
            defaultDate={`${data.label}-01`}
            onSubmit={(body) =>
              postJson(`/planned-expenses/${paymentTarget}/payments/`, body)
            }
            onSaved={async () => {
              setPaymentTarget(null);
              await refresh();
            }}
          />
        )}
      </Modal>

      <Modal
        title="Record received income"
        description="Record the actual amount that reached your bank."
        trigger={<span />}
        open={incomeTarget !== null}
        onOpenChange={(open) => !open && setIncomeTarget(null)}
      >
        {incomeTarget && (
          <MoneyMovementForm
            label="Amount received"
            defaultDate={`${data.label}-01`}
            onSubmit={(body) => postJson(`/income-plans/${incomeTarget}/receive/`, body)}
            onSaved={async () => {
              setIncomeTarget(null);
              await refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function MoneyMovementForm({
  label,
  defaultDate,
  onSubmit,
  onSaved,
}: {
  label: string;
  defaultDate: string;
  onSubmit: (body: unknown) => Promise<unknown>;
  onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [dateValue, setDateValue] = useState(defaultDate);
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: () => onSubmit({ amount, date: dateValue, notes }),
    onSuccess: onSaved,
  });

  return (
    <form
      className="stack-form"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <label>
        {label}
        <div className="money-input">
          <span>Rs</span>
          <input
            required
            min="0.01"
            step="0.01"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
          />
        </div>
      </label>
      <label>
        Date
        <input
          required
          type="date"
          value={dateValue}
          onChange={(event) => setDateValue(event.target.value)}
        />
      </label>
      <label>
        Notes <span className="optional">optional</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {mutation.isError && <p className="form-error">Please check the amount and try again.</p>}
      <button className="button primary full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save transaction"}
      </button>
    </form>
  );
}

function PersonalExpenseForm({
  period,
  defaultDate,
  onSaved,
}: {
  period: number;
  defaultDate: string;
  onSaved: () => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dateValue, setDateValue] = useState(defaultDate);
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      postJson("/personal-expenses/", {
        period,
        description,
        amount,
        date: dateValue,
        notes,
      }),
    onSuccess: onSaved,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };
  return (
    <form className="stack-form" onSubmit={submit}>
      <label>
        What was it?
        <input
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. Lunch, books, haircut"
        />
      </label>
      <label>
        Amount
        <div className="money-input">
          <span>Rs</span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
          />
        </div>
      </label>
      <label>
        Date
        <input
          type="date"
          value={dateValue}
          onChange={(event) => setDateValue(event.target.value)}
        />
      </label>
      <label>
        Private notes <span className="optional">optional</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {mutation.isError && <p className="form-error">Could not save this expense.</p>}
      <button className="button primary full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Add private expense"}
      </button>
    </form>
  );
}
