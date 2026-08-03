import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  ArrowDownToLine,
  CalendarPlus,
  CalendarDays,
  Check,
  CircleDollarSign,
  LockKeyhole,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  WalletCards,
} from "lucide-react";
import { type FormEvent, type RefObject, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  api,
  appLocale,
  deleteJson,
  formatPkr,
  money,
  patchJson,
  postJson,
} from "../api/client";
import { Modal } from "../components/Modal";
import { MonthlyMetricGrid } from "../components/MonthlyMetricGrid";
import { EmptyState, ErrorPanel, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import type { Dashboard, Month, Paginated, RolloverPreview, SavingsGoal, Session } from "../types";

interface PersonalExpense {
  id: number;
  period: number;
  date: string;
  amount: number | string;
  description: string;
  notes: string;
}

interface LedgerEntry {
  id: number;
  period: number;
  entry_type: "income" | "household_expense" | "adjustment";
  direction: "credit" | "debit";
  date: string;
  amount: number | string;
  description: string;
  notes: string;
}

type DeleteTarget =
  | { kind: "shared"; transaction: LedgerEntry }
  | { kind: "personal"; transaction: PersonalExpense };

export function MonthPage() {
  const { session } = useOutletContext<{ session: Session }>();
  const { label } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentTarget, setPaymentTarget] = useState<number | null>(null);
  const [incomeTarget, setIncomeTarget] = useState<number | null>(null);
  const [addMonthOpen, setAddMonthOpen] = useState(false);
  const [deleteMonthOpen, setDeleteMonthOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [personalEdit, setPersonalEdit] = useState<PersonalExpense | null>(null);
  const [sharedEdit, setSharedEdit] = useState<LedgerEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const paymentAmountRef = useRef<HTMLInputElement>(null);
  const month = useQuery({
    queryKey: ["month", label ?? "current"],
    queryFn: () =>
      api<Month>(label ? `/months/by-label/?month=${encodeURIComponent(label)}` : "/months/current/"),
  });
  const monthMetrics = useQuery({
    queryKey: ["dashboard", month.data?.label],
    queryFn: () =>
      api<Dashboard>(`/dashboard/?month=${encodeURIComponent(month.data!.label)}`),
    enabled: Boolean(month.data),
  });
  const months = useQuery({
    queryKey: ["months"],
    queryFn: () => api<Paginated<Month>>("/months/"),
  });
  const personal = useQuery({
    queryKey: ["personal-expenses"],
    queryFn: () => api<Paginated<PersonalExpense>>("/personal-expenses/"),
  });
  const shared = useQuery({
    queryKey: ["ledger"],
    queryFn: () => api<Paginated<LedgerEntry>>("/ledger/"),
    enabled: session.is_owner,
  });
  const goals = useQuery({
    queryKey: ["savings-goals"],
    queryFn: () => api<Paginated<SavingsGoal>>("/savings-goals/"),
    enabled: session.is_owner,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["month"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["personal-expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["ledger"] }),
      queryClient.invalidateQueries({ queryKey: ["savings-goals"] }),
      queryClient.invalidateQueries({ queryKey: ["trends"] }),
    ]);
  };

  if (month.isLoading) return <Skeleton height={520} />;
  if (month.isError || !month.data) {
    if (session.is_owner && months.data?.results.length === 0) {
      return (
        <>
          <PageHeader
            eyebrow="Monthly workspace"
            title="No active months"
            description="Deleted months stay hidden until you explicitly create them again."
            actions={
              <Modal
                title="Add a month"
                description="Create a fresh monthly workspace from your recurring plan."
                trigger={
                  <button className="button primary">
                    <CalendarPlus size={17} /> Add month
                  </button>
                }
                open={addMonthOpen}
                onOpenChange={setAddMonthOpen}
              >
                <AddMonthForm
                  goals={goals.data?.results ?? []}
                  onCreated={async (created) => {
                    setAddMonthOpen(false);
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: ["months"] }),
                      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
                      queryClient.invalidateQueries({ queryKey: ["savings-goals"] }),
                      queryClient.invalidateQueries({ queryKey: ["trends"] }),
                    ]);
                    navigate(`/app/month/${created.label}`);
                  }}
                />
              </Modal>
            }
          />
          <EmptyState
            icon={<CalendarPlus size={24} />}
            title="Your month list is empty"
            description="Use Add month when you are ready to start a new or previously deleted monthly workspace."
          />
        </>
      );
    }
    return <ErrorPanel />;
  }
  const data = month.data;

  const plannedTotal = data.planned_expenses.reduce(
    (sum, item) => sum + money(item.expected_amount),
    0,
  );
  const paidTotal = data.planned_expenses.reduce(
    (sum, item) => sum + money(item.paid_amount),
    0,
  );
  const paymentExpense = data.planned_expenses.find(
    (expense) => expense.id === paymentTarget,
  );
  const incomePlan = data.income_plans.find((income) => income.id === incomeTarget);

  return (
    <>
      {monthMetrics.data ? (
        <MonthlyMetricGrid data={monthMetrics.data} />
      ) : monthMetrics.isLoading ? (
        <section className="metric-grid" aria-label="Loading monthly financial summary">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} height={135} />
          ))}
        </section>
      ) : null}

      <PageHeader
        eyebrow="Monthly workspace"
        title={new Date(data.year, data.month - 1).toLocaleDateString(appLocale(), {
          month: "long",
          year: "numeric",
        })}
        description="Track what was planned and record only what actually moved through your bank."
        actions={
          <div className="inline-actions" data-tour="month-actions">
            <label className="month-picker">
              <span className="sr-only">Choose month</span>
              <select
                value={data.label}
                onChange={(event) => navigate(`/app/month/${event.target.value}`)}
              >
                {(months.data?.results ?? [data]).map((period) => (
                  <option key={period.id} value={period.label}>
                    {new Date(period.year, period.month - 1).toLocaleDateString(appLocale(), {
                      month: "long",
                      year: "numeric",
                    })}
                  </option>
                ))}
              </select>
            </label>
            {session.is_owner && (
              <>
                <Modal
                  title="Add a previous month"
                  description="Create a monthly workspace from your recurring plan, then enter its complete historical flow."
                  trigger={
                    <button className="button secondary">
                      <CalendarPlus size={17} /> Add month
                    </button>
                  }
                  open={addMonthOpen}
                  onOpenChange={setAddMonthOpen}
                >
                  <AddMonthForm
                    goals={goals.data?.results ?? []}
                    onCreated={async (created) => {
                      setAddMonthOpen(false);
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["months"] }),
                        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
                        queryClient.invalidateQueries({ queryKey: ["savings-goals"] }),
                        queryClient.invalidateQueries({ queryKey: ["trends"] }),
                      ]);
                      navigate(`/app/month/${created.label}`);
                    }}
                  />
                </Modal>
                <Modal
                  title={`Delete ${new Date(data.year, data.month - 1).toLocaleDateString(
                    appLocale(),
                    { month: "long", year: "numeric" },
                  )}?`}
                  description="This removes the complete financial flow for this month and cannot be undone."
                  trigger={
                    <button className="button danger">
                      <Trash2 size={17} /> Delete month
                    </button>
                  }
                  open={deleteMonthOpen}
                  onOpenChange={setDeleteMonthOpen}
                >
                  <MonthDeleteConfirmation
                    month={data}
                    onDeleted={async () => {
                      const fallback = months.data?.results.find(
                        (period) => period.id !== data.id,
                      );
                      setDeleteMonthOpen(false);
                      queryClient.removeQueries({
                        queryKey: ["month", data.label],
                        exact: true,
                      });
                      navigate(
                        fallback ? `/app/month/${fallback.label}` : "/app/dashboard",
                        { replace: true },
                      );
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["months"] }),
                        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
                        queryClient.invalidateQueries({ queryKey: ["personal-expenses"] }),
                        queryClient.invalidateQueries({ queryKey: ["ledger"] }),
                        queryClient.invalidateQueries({ queryKey: ["savings-goals"] }),
                        queryClient.invalidateQueries({ queryKey: ["trends"] }),
                        queryClient.invalidateQueries({ queryKey: ["bank"] }),
                      ]);
                    }}
                    onCancel={() => setDeleteMonthOpen(false)}
                  />
                </Modal>
              </>
            )}
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

      {money(data.safe_to_spend_carryover) > 0 && (
        <div className="callout positive month-carryover-callout">
          <ArrowRightLeft size={19} />
          <div>
            <strong>{formatPkr(data.safe_to_spend_carryover)} carried forward</strong>
            <span>This amount from the previous month is included in this month’s safe to spend.</span>
          </div>
        </div>
      )}

      <section className="month-summary" data-tour="month-summary">
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
          <small>Reserved automatically when income is received</small>
        </div>
      </section>

      <div className="workspace-grid" data-tour="month-workspace">
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
                  {session.is_owner && !complete && (
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

        <section className="panel span-2" data-tour="planned-obligations">
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
                  <th>Unpaid</th>
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
                        appLocale(),
                        { day: "numeric", month: "short" },
                      )}
                    </td>
                    <td>{formatPkr(expense.expected_amount)}</td>
                    <td>
                      {formatPkr(expense.paid_amount)}
                      {money(expense.carryover_credit) > 0 && (
                        <small className="carryover-note">
                          {formatPkr(expense.carryover_credit)} carried forward
                        </small>
                      )}
                    </td>
                    <td>
                      <strong className={money(expense.remaining_amount) > 0 ? "negative-text" : ""}>
                        {formatPkr(expense.remaining_amount)}
                      </strong>
                    </td>
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

      {session.is_owner && (
        <section className="panel" data-tour="month-transactions">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Actual bank movements</span>
              <h2>Shared transactions</h2>
            </div>
            <small>Income, bill payments, and reconciliation adjustments</small>
          </div>
          {shared.data?.results.some((item) => item.period === data.id) ? (
            <div className="expense-table-wrap">
              <table className="expense-table transaction-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shared.data.results
                    .filter((item) => item.period === data.id)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.description}</strong>
                          {item.notes && <small className="transaction-note">{item.notes}</small>}
                        </td>
                        <td>
                          <span className={`status-chip ${item.direction}`}>
                            {transactionType(item.entry_type)}
                          </span>
                        </td>
                        <td>
                          {new Date(`${item.date}T00:00:00`).toLocaleDateString(appLocale(), {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td className={item.direction === "credit" ? "positive-text" : ""}>
                          {item.direction === "credit" ? "+" : "−"}
                          {formatPkr(item.amount)}
                        </td>
                        <td>
                          <div className="transaction-actions">
                            <button className="table-action" onClick={() => setSharedEdit(item)}>
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              className="table-action danger-action"
                              onClick={() =>
                                setDeleteTarget({ kind: "shared", transaction: item })
                              }
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Receipt size={23} />}
              title="No shared transactions yet"
              description="Received income and household payments will appear here."
            />
          )}
        </section>
      )}

      <section className="panel" data-tour="personal-expenses">
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
                    <small>
                      {new Date(`${item.date}T00:00:00`).toLocaleDateString(appLocale())}
                    </small>
                  </div>
                  <b>{formatPkr(item.amount)}</b>
                  <div className="personal-actions">
                    <button
                      className="icon-button personal-edit"
                      aria-label={`Edit ${item.description}`}
                      onClick={() => setPersonalEdit(item)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button personal-delete"
                      aria-label={`Delete ${item.description}`}
                      onClick={() =>
                        setDeleteTarget({ kind: "personal", transaction: item })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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
        initialFocusRef={paymentAmountRef}
      >
        {paymentExpense && (
          <div className="household-payment-form">
            <HouseholdPaymentSummary expense={paymentExpense} />
            <MoneyMovementForm
              label="Payment amount"
              defaultDate={`${data.label}-01`}
              amountInputRef={paymentAmountRef}
              onSubmit={(body) =>
                postJson(`/planned-expenses/${paymentExpense.id}/payments/`, body)
              }
              onSaved={async () => {
                setPaymentTarget(null);
                await refresh();
              }}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="Edit shared transaction"
        description="Correct the amount, date, or notes without changing what kind of transaction it is."
        trigger={<span />}
        open={sharedEdit !== null}
        onOpenChange={(open) => !open && setSharedEdit(null)}
      >
        {sharedEdit && (
          <TransactionEditForm
            transaction={sharedEdit}
            onSaved={async () => {
              setSharedEdit(null);
              await refresh();
            }}
          />
        )}
      </Modal>

      <Modal
        title="Edit private expense"
        description="Only you can see these details."
        trigger={<span />}
        open={personalEdit !== null}
        onOpenChange={(open) => !open && setPersonalEdit(null)}
      >
        {personalEdit && (
          <PersonalExpenseForm
            period={personalEdit.period}
            defaultDate={personalEdit.date}
            expense={personalEdit}
            onSaved={async () => {
              setPersonalEdit(null);
              await refresh();
            }}
          />
        )}
      </Modal>

      <Modal
        title="Delete transaction?"
        description="This permanently removes the transaction and immediately recalculates every affected balance."
        trigger={<span />}
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        {deleteTarget && (
          <TransactionDeleteConfirmation
            target={deleteTarget}
            onDeleted={async () => {
              setDeleteTarget(null);
              await refresh();
            }}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </Modal>

      <Modal
        title="Record received income"
        description="Confirm the receiving date and reserve this month’s fixed savings."
        trigger={<span />}
        open={incomeTarget !== null}
        onOpenChange={(open) => !open && setIncomeTarget(null)}
      >
        {incomePlan && (
          <IncomeReceiptForm
            income={incomePlan}
            savingsTarget={data.savings_target}
            fixedSavingsAllocated={data.fixed_savings_allocated}
            goals={goals.data?.results ?? []}
            defaultDate={`${data.label}-01`}
            onSubmit={(body) => postJson(`/income-plans/${incomePlan.id}/receive/`, body)}
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

function previousMonthLabel() {
  const previous = new Date();
  previous.setDate(1);
  previous.setMonth(previous.getMonth() - 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
}

export function AddMonthForm({
  goals,
  onCreated,
}: {
  goals: SavingsGoal[];
  onCreated: (month: Month) => Promise<void>;
}) {
  const [monthValue, setMonthValue] = useState(previousMonthLabel);
  const [preview, setPreview] = useState<RolloverPreview | null>(null);
  const [billGoals, setBillGoals] = useState<Record<number, string>>({});
  const [safeAction, setSafeAction] = useState<"" | "carryover" | "savings">("");
  const [safeGoal, setSafeGoal] = useState("");
  const activeGoals = goals.filter((goal) => goal.active);
  const createMutation = useMutation({
    mutationFn: (rollover: unknown | null) => {
      const [year, month] = monthValue.split("-").map(Number);
      return postJson<Month>("/months/generate/", {
        year,
        month,
        ...(rollover ? { rollover } : {}),
      });
    },
    onSuccess: onCreated,
  });
  const previewMutation = useMutation({
    mutationFn: () => {
      const [year, month] = monthValue.split("-").map(Number);
      return api<RolloverPreview>(`/months/rollover-preview/?year=${year}&month=${month}`);
    },
    onSuccess: (result) => {
      if (
        !result.unpaid_expenses.length
        && money(result.safe_to_spend) <= 0
      ) {
        createMutation.mutate(null);
        return;
      }
      setPreview(result);
      setBillGoals({});
      setSafeAction("");
      setSafeGoal("");
    },
  });
  const rolloverReady = Boolean(
    preview
      && preview.unpaid_expenses.every((expense) => billGoals[expense.id])
      && (money(preview.safe_to_spend) <= 0
        || (safeAction === "carryover")
        || (safeAction === "savings" && safeGoal)),
  );

  const createWithRollover = () => {
    if (!preview || !rolloverReady) return;
    createMutation.mutate({
      bill_allocations: preview.unpaid_expenses.map((expense) => ({
        planned_expense: expense.id,
        destination_goal: Number(billGoals[expense.id]),
      })),
      safe_to_spend:
        money(preview.safe_to_spend) > 0
          ? {
              action: safeAction,
              destination_goal: safeAction === "savings" ? Number(safeGoal) : null,
            }
          : null,
    });
  };

  return (
    <form
      className="stack-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (preview) createWithRollover();
        else previewMutation.mutate();
      }}
    >
      {!preview ? (
        <>
          <label>
            Month
            <input
              required
              type="month"
              min="2000-01"
              max="2100-12"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
            />
          </label>
          <p className="field-help">
            Income, bills, due dates, and the savings target are copied from your recurring plan.
            We’ll check the previous month for money that still needs a destination.
          </p>
        </>
      ) : (
        <div className="rollover-step">
          <div className="rollover-heading">
            <span>New month allocations</span>
            <strong>Give every reserved amount a destination</strong>
            <p>These are internal allocations. Your calculated bank balance will not change.</p>
          </div>
          {preview.unpaid_expenses.length > 0 && (
            <div className="rollover-group">
              <h3>Unpaid household amounts</h3>
              <p>Choose a savings goal for each amount that was planned but not paid.</p>
              {preview.unpaid_expenses.map((expense) => (
                <label className="rollover-row" key={expense.id}>
                  <span><strong>{expense.name}</strong><small>{formatPkr(expense.remaining_amount)} left unpaid</small></span>
                  <select
                    required
                    value={billGoals[expense.id] ?? ""}
                    onChange={(event) => setBillGoals({ ...billGoals, [expense.id]: event.target.value })}
                  >
                    <option value="">Choose savings goal</option>
                    {activeGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          {money(preview.safe_to_spend) > 0 && (
            <div className="rollover-group">
              <h3>Safe-to-spend leftover</h3>
              <p>{formatPkr(preview.safe_to_spend)} remained after planned bills, savings, and personal spending.</p>
              <label>
                What should happen to this amount?
                <select required value={safeAction} onChange={(event) => setSafeAction(event.target.value as typeof safeAction)}>
                  <option value="">Choose an action</option>
                  <option value="carryover">Add to the new month’s safe to spend</option>
                  <option value="savings">Move to a savings goal</option>
                </select>
              </label>
              {safeAction === "savings" && (
                <label>
                  Savings goal
                  <select required value={safeGoal} onChange={(event) => setSafeGoal(event.target.value)}>
                    <option value="">Choose savings goal</option>
                    {activeGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          {!activeGoals.length && preview.unpaid_expenses.length > 0 && (
            <p className="form-error">Create or reactivate a savings goal before allocating unpaid household amounts.</p>
          )}
          <button type="button" className="button secondary small rollover-back" onClick={() => setPreview(null)}>
            <ArrowLeft size={15} /> Change month
          </button>
        </div>
      )}
      {(previewMutation.isError || createMutation.isError) && <p className="form-error">Could not create this month. Please review the rollover choices.</p>}
      <button className="button primary full" disabled={previewMutation.isPending || createMutation.isPending || (preview !== null && !rolloverReady)}>
        <CalendarPlus size={17} />
        {previewMutation.isPending
          ? "Checking previous month…"
          : createMutation.isPending
            ? "Creating…"
            : preview
              ? "Create month and apply choices"
              : "Continue"}
      </button>
    </form>
  );
}

function MonthDeleteConfirmation({
  month,
  onDeleted,
  onCancel,
}: {
  month: Month;
  onDeleted: () => Promise<void>;
  onCancel: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const mutation = useMutation({
    mutationFn: () => deleteJson(`/months/${month.id}/`),
    onSuccess: onDeleted,
  });

  return (
    <form
      className="stack-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmation === month.label) mutation.mutate();
      }}
    >
      <div className="month-delete-warning">
        <strong>This deletes:</strong>
        <ul>
          <li>All income and shared bank transactions recorded in this month</li>
          <li>Every member’s private expenses for this month</li>
          <li>Savings movements and bank reconciliations dated in this month</li>
          <li>The month’s income and household-expense plan snapshots</li>
        </ul>
        <p>Your recurring templates and savings goals will remain unchanged.</p>
      </div>
      <label>
        Type <strong>{month.label}</strong> to confirm
        <input
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={month.label}
          autoComplete="off"
        />
      </label>
      {mutation.isError && (
        <p className="form-error">Could not delete this month. Please try again.</p>
      )}
      <div className="dialog-actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          Keep month
        </button>
        <button
          className="button danger"
          type="submit"
          disabled={mutation.isPending || confirmation !== month.label}
        >
          <Trash2 size={16} />
          {mutation.isPending ? "Deleting…" : "Delete complete month"}
        </button>
      </div>
    </form>
  );
}

function TransactionDeleteConfirmation({
  target,
  onDeleted,
  onCancel,
}: {
  target: DeleteTarget;
  onDeleted: () => Promise<void>;
  onCancel: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () =>
      deleteJson(
        target.kind === "shared"
          ? `/ledger/${target.transaction.id}/`
          : `/personal-expenses/${target.transaction.id}/`,
      ),
    onSuccess: onDeleted,
  });

  return (
    <div className="delete-confirmation">
      <div className="delete-transaction-summary">
        <span>{target.transaction.description}</span>
        <strong>{formatPkr(target.transaction.amount)}</strong>
        <small>
          {new Date(`${target.transaction.date}T00:00:00`).toLocaleDateString(appLocale(), {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </small>
      </div>
      <p>
        {target.kind === "shared"
          ? "If this is a bill payment, its paid and remaining amounts will be updated."
          : "This private expense will no longer count toward your spending totals."}
      </p>
      {mutation.isError && (
        <p className="form-error">Could not delete this transaction. Please try again.</p>
      )}
      <div className="dialog-actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          Keep transaction
        </button>
        <button
          className="button danger"
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Trash2 size={16} />
          {mutation.isPending ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </div>
  );
}

function transactionType(entryType: LedgerEntry["entry_type"]) {
  if (entryType === "income") return "Income";
  if (entryType === "household_expense") return "Household payment";
  return "Adjustment";
}

export function HouseholdPaymentSummary({
  expense,
}: {
  expense: Month["planned_expenses"][number];
}) {
  return (
    <section className="payment-expectation" aria-label="Payment details">
      <div className="payment-expectation-head">
        <span className="payment-expectation-icon">
          <Receipt size={19} />
        </span>
        <div>
          <small>You are paying</small>
          <strong>{expense.name}</strong>
          <span>
            Due{" "}
            {new Date(`${expense.due_date}T00:00:00`).toLocaleDateString(appLocale(), {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <span className={`status-chip ${expense.status}`}>{expense.status}</span>
      </div>
      <div className="payment-expectation-grid">
        <div>
          <span>Expected total</span>
          <strong>{formatPkr(expense.expected_amount)}</strong>
        </div>
        <div>
          <span>Paid so far</span>
          <strong>{formatPkr(expense.paid_amount)}</strong>
          {money(expense.carryover_credit) > 0 && (
            <small>{formatPkr(expense.carryover_credit)} carried forward</small>
          )}
        </div>
        <div className={money(expense.remaining_amount) > 0 ? "remaining" : "settled"}>
          <span>Remaining to pay</span>
          <strong>{formatPkr(expense.remaining_amount)}</strong>
          {money(expense.overpaid_amount) > 0 && (
            <small>{formatPkr(expense.overpaid_amount)} overpaid</small>
          )}
        </div>
      </div>
      <p>
        Enter the amount you are paying now. You can pay the full remaining balance or
        record a partial payment.
      </p>
    </section>
  );
}

function TransactionEditForm({
  transaction,
  onSaved,
}: {
  transaction: LedgerEntry;
  onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [dateValue, setDateValue] = useState(transaction.date);
  const [notes, setNotes] = useState(transaction.notes);
  const mutation = useMutation({
    mutationFn: () =>
      patchJson(`/ledger/${transaction.id}/`, {
        amount,
        date: dateValue,
        notes,
      }),
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
        Amount
        <div className="money-input">
          <span>Rs</span>
          <input
            required
            min="0.01"
            step="0.01"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
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
      {mutation.isError && (
        <p className="form-error">Could not update this transaction. Check the date and amount.</p>
      )}
      <button className="button primary full" disabled={mutation.isPending}>
        {mutation.isPending ? "Updating…" : "Update transaction"}
      </button>
    </form>
  );
}

function MoneyMovementForm({
  label,
  defaultDate,
  onSubmit,
  onSaved,
  amountInputRef,
}: {
  label: string;
  defaultDate: string;
  onSubmit: (body: unknown) => Promise<unknown>;
  onSaved: () => Promise<void>;
  amountInputRef?: RefObject<HTMLInputElement | null>;
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
            ref={amountInputRef}
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

export function IncomeReceiptForm({
  income,
  savingsTarget,
  fixedSavingsAllocated,
  goals,
  defaultDate,
  onSubmit,
  onSaved,
}: {
  income: Month["income_plans"][number];
  savingsTarget: Month["savings_target"];
  fixedSavingsAllocated: boolean;
  goals: SavingsGoal[];
  defaultDate: string;
  onSubmit: (body: unknown) => Promise<unknown>;
  onSaved: () => Promise<void>;
}) {
  const [dateValue, setDateValue] = useState(defaultDate);
  const [savingsGoal, setSavingsGoal] = useState("");
  const activeGoals = goals.filter((goal) => goal.active);
  const amountToReceive = Math.max(
    money(income.planned_amount) - money(income.received_amount),
    0,
  );
  const requiresSavingsGoal = money(savingsTarget) > 0 && !fixedSavingsAllocated;
  const mutation = useMutation({
    mutationFn: () =>
      onSubmit({
        date: dateValue,
        savings_goal: requiresSavingsGoal ? Number(savingsGoal) : null,
      }),
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
      <section className="payment-expectation" aria-label="Income receipt details">
        <div className="payment-expectation-head">
          <span className="payment-expectation-icon">
            <ArrowDownToLine size={19} />
          </span>
          <div>
            <small>You are receiving</small>
            <strong>{income.name}</strong>
            <span>{formatPkr(amountToReceive)} will be recorded in your bank balance</span>
          </div>
        </div>
      </section>
      <label>
        Date received
        <input
          required
          type="date"
          value={dateValue}
          onChange={(event) => setDateValue(event.target.value)}
        />
      </label>
      {requiresSavingsGoal && (
        <label>
          Savings goal for fixed monthly savings
          <select
            required
            value={savingsGoal}
            onChange={(event) => setSavingsGoal(event.target.value)}
          >
            <option value="">Choose savings goal</option>
            {activeGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
          <span className="field-help">
            {formatPkr(savingsTarget)} will move into this savings bucket internally. It will
            not change your bank balance again.
          </span>
        </label>
      )}
      {requiresSavingsGoal && !activeGoals.length && (
        <p className="form-error">
          Create or reactivate a savings goal before receiving this income.
        </p>
      )}
      {mutation.isError && (
        <p className="form-error">Could not record this income. Check the date and try again.</p>
      )}
      <button
        className="button primary full"
        disabled={
          mutation.isPending
          || amountToReceive <= 0
          || (requiresSavingsGoal && (!savingsGoal || !activeGoals.length))
        }
      >
        {mutation.isPending ? "Receiving…" : `Receive ${formatPkr(amountToReceive)}`}
      </button>
    </form>
  );
}

function PersonalExpenseForm({
  period,
  defaultDate,
  expense,
  onSaved,
}: {
  period: number;
  defaultDate: string;
  expense?: PersonalExpense;
  onSaved: () => Promise<void>;
}) {
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [dateValue, setDateValue] = useState(defaultDate);
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        period,
        description,
        amount,
        date: dateValue,
        notes,
      };
      return expense
        ? patchJson(`/personal-expenses/${expense.id}/`, body)
        : postJson("/personal-expenses/", body);
    },
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
        {mutation.isPending
          ? "Saving…"
          : expense
            ? "Update private expense"
            : "Add private expense"}
      </button>
    </form>
  );
}
