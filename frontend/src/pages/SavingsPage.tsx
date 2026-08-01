import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  History,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, appLocale, formatPkr, money, patchJson, postJson } from "../api/client";
import { Modal } from "../components/Modal";
import { SavingsMovementForm } from "../components/SavingsMovementForm";
import { EmptyState, ErrorPanel, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import type {
  Month,
  Paginated,
  SavingsGoal,
  SavingsMovement,
  Session,
} from "../types";

export function SavingsPage() {
  const { session } = useOutletContext<{ session: Session }>();
  const queryClient = useQueryClient();
  const [movementOpen, setMovementOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const goals = useQuery({
    queryKey: ["savings-goals"],
    queryFn: () => api<Paginated<SavingsGoal>>("/savings-goals/"),
  });
  const movements = useQuery({
    queryKey: ["savings-movements"],
    queryFn: () => api<Paginated<SavingsMovement>>("/savings-movements/"),
  });
  const month = useQuery({
    queryKey: ["month", "current"],
    queryFn: () => api<Month>("/months/current/"),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["savings-goals"] }),
      queryClient.invalidateQueries({ queryKey: ["savings-movements"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["trends"] }),
    ]);
  };

  if (goals.isLoading || movements.isLoading || month.isLoading) return <Skeleton height={540} />;
  if (
    goals.isError ||
    movements.isError ||
    month.isError ||
    !goals.data ||
    !movements.data ||
    !month.data
  ) {
    return <ErrorPanel />;
  }

  const total = goals.data.results.reduce((sum, goal) => sum + money(goal.balance), 0);
  const activeGoalCount = goals.data.results.filter((goal) => goal.active).length;

  return (
    <>
      <PageHeader
        eyebrow="Virtual envelopes"
        title="Savings that have a purpose"
        description="Record external savings deposits, protect them with goals, and keep your calculated bank balance accurate."
        actions={
          session.is_owner ? (
            <div className="inline-actions" data-tour="savings-actions">
              <Modal
                title="Move savings"
                description="Contributions increase the calculated bank, withdrawals decrease it, and transfers stay bank-neutral."
                trigger={
                  <button className="button primary">
                    <ArrowRightLeft size={17} /> Add movement
                  </button>
                }
                open={movementOpen}
                onOpenChange={setMovementOpen}
              >
                <SavingsMovementForm
                  goals={goals.data.results}
                  period={month.data.id}
                  defaultDate={`${month.data.label}-01`}
                  onSaved={async () => {
                    setMovementOpen(false);
                    await refresh();
                  }}
                />
              </Modal>
              <Modal
                title="Create a savings goal"
                trigger={
                  <button className="button secondary">
                    <Plus size={17} /> New goal
                  </button>
                }
                open={goalOpen}
                onOpenChange={setGoalOpen}
              >
                <GoalForm
                  onSaved={async () => {
                    setGoalOpen(false);
                    await refresh();
                  }}
                />
              </Modal>
            </div>
          ) : undefined
        }
      />

      <Modal
        title="Edit savings goal"
        description="Update the goal name, target, or active status. Use a movement to change its balance."
        trigger={<span />}
        open={editingGoal !== null}
        onOpenChange={(open) => !open && setEditingGoal(null)}
      >
        {editingGoal && (
          <GoalForm
            goal={editingGoal}
            onSaved={async () => {
              setEditingGoal(null);
              await refresh();
            }}
          />
        )}
      </Modal>

      <section className="savings-hero" data-tour="savings-overview">
        <div>
          <span>Total reserved</span>
          <strong>{formatPkr(total)}</strong>
          <p>Across {activeGoalCount} active savings envelopes</p>
        </div>
        <div className="savings-hero-icon">
          <PiggyBank size={38} />
        </div>
      </section>

      <div data-tour="savings-buckets">
        {goals.data.results.length ? (
          <section className="goal-card-grid">
            {goals.data.results.map((goal, index) => {
              const target = money(goal.target_amount);
              const balance = money(goal.balance);
              const percentage = target ? (balance / target) * 100 : 0;
              return (
                <article className="goal-card" key={goal.id}>
                  <div className="goal-card-top">
                    <span className={`goal-art art-${(index % 4) + 1}`}>
                      {index % 2 ? <Target size={21} /> : <TrendingUp size={21} />}
                    </span>
                    <div className="goal-card-actions">
                      <span className={`active-pill ${goal.active ? "" : "inactive"}`}>
                        {goal.active ? "Active" : "Inactive"}
                      </span>
                      {session.is_owner && (
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Edit ${goal.name}`}
                          onClick={() => setEditingGoal(goal)}
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  <h2>{goal.name}</h2>
                  <strong>{formatPkr(goal.balance)}</strong>
                  {goal.target_amount ? (
                    <>
                      <ProgressBar value={balance} max={target} />
                      <div className="goal-card-meta">
                        <span>{Math.min(percentage, 100).toFixed(0)}% complete</span>
                        <span>{formatPkr(Math.max(target - balance, 0))} left</span>
                      </div>
                    </>
                  ) : (
                    <p className="goal-no-target">Open-ended savings · no target required</p>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <EmptyState
            icon={<PiggyBank size={24} />}
            title="Create your first savings envelope"
            description="Goals can represent emergency savings, gifts, a baby fund, travel, or anything important."
          />
        )}
      </div>

      <SavingsTransactionHistory
        goals={goals.data.results}
        movements={movements.data.results}
        totalCount={movements.data.count}
      />
    </>
  );
}

export function SavingsTransactionHistory({
  goals,
  movements,
  totalCount,
}: {
  goals: SavingsGoal[];
  movements: SavingsMovement[];
  totalCount: number;
}) {
  const [goalFilter, setGoalFilter] = useState("all");
  const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]));
  const filtered = movements.filter(
    (movement) =>
      goalFilter === "all" ||
      movement.source_goal === Number(goalFilter) ||
      movement.destination_goal === Number(goalFilter),
  );
  const credited = filtered.reduce(
    (total, movement) => total + (movement.destination_goal ? money(movement.amount) : 0),
    0,
  );
  const debited = filtered.reduce(
    (total, movement) => total + (movement.source_goal ? money(movement.amount) : 0),
    0,
  );

  const movementTitle = (movement: SavingsMovement) => {
    const source = movement.source_goal ? goalNames.get(movement.source_goal) : null;
    const destination = movement.destination_goal
      ? goalNames.get(movement.destination_goal)
      : null;
    if (source && destination) return `${source} → ${destination}`;
    return destination ?? source ?? "Savings goal";
  };

  return (
    <section className="panel savings-ledger-panel" data-tour="savings-ledger">
      <div className="panel-heading savings-ledger-heading">
        <div>
          <span className="panel-kicker">Savings ledger</span>
          <h2>Credits and debits</h2>
        </div>
        <label className="savings-goal-filter">
          <span>Filter by goal</span>
          <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)}>
            <option value="all">All savings goals</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length ? (
        <>
          <div className="savings-ledger-summary">
            <div>
              <span className="ledger-summary-icon credit">
                <ArrowDownLeft size={17} />
              </span>
              <p>
                <small>Total credited</small>
                <strong className="positive-text">+{formatPkr(credited)}</strong>
              </p>
            </div>
            <div>
              <span className="ledger-summary-icon debit">
                <ArrowUpRight size={17} />
              </span>
              <p>
                <small>Total debited</small>
                <strong className="negative-text">−{formatPkr(debited)}</strong>
              </p>
            </div>
            <small className="ledger-count">
              Showing {filtered.length} of {totalCount} recent movements
            </small>
          </div>
          <div className="expense-table-wrap">
            <table className="expense-table savings-ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Movement</th>
                  <th>Credit</th>
                  <th>Debit</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((movement) => {
                  const bankNeutral = ["transfer", "allocation"].includes(movement.kind);
                  return (
                    <tr key={movement.id}>
                      <td>
                        {new Date(`${movement.date}T00:00:00`).toLocaleDateString(appLocale(), {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <strong>{movementTitle(movement)}</strong>
                        <span className={`status-chip savings-kind ${movement.kind}`}>
                          {movement.kind === "allocation"
                            ? "Internal allocation"
                            : movement.kind.charAt(0).toUpperCase() + movement.kind.slice(1)}
                        </span>
                      </td>
                      <td>
                        {movement.destination_goal ? (
                          <div className="savings-ledger-value credit">
                            <strong>+{formatPkr(movement.amount)}</strong>
                            <small>{goalNames.get(movement.destination_goal)}</small>
                          </div>
                        ) : (
                          <span className="ledger-empty">—</span>
                        )}
                      </td>
                      <td>
                        {movement.source_goal ? (
                          <div className="savings-ledger-value debit">
                            <strong>−{formatPkr(movement.amount)}</strong>
                            <small>{goalNames.get(movement.source_goal)}</small>
                          </div>
                        ) : (
                          <span className="ledger-empty">—</span>
                        )}
                      </td>
                      <td>
                        <span className="savings-movement-note">
                          {movement.notes || "No notes"}
                        </span>
                        <small className="savings-bank-impact">
                          {bankNeutral
                            ? "Internal movement · bank-neutral"
                            : movement.kind === "contribution"
                              ? "Calculated bank increases"
                              : "Calculated bank decreases"}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="savings-ledger-footnote">
            Opening balances are included in each goal balance but are not recorded as movements.
          </p>
        </>
      ) : (
        <EmptyState
          icon={<History size={24} />}
          title={goalFilter === "all" ? "No savings movements yet" : "No movements for this goal"}
          description="Contributions, withdrawals, transfers, and monthly allocations will appear here."
        />
      )}
    </section>
  );
}
export function GoalForm({
  goal,
  onSaved,
}: {
  goal?: SavingsGoal;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [opening, setOpening] = useState("0");
  const [target, setTarget] = useState(goal?.target_amount ? String(goal.target_amount) : "");
  const [active, setActive] = useState(goal?.active ?? true);
  const mutation = useMutation({
    mutationFn: () => {
      const sharedPayload = {
        name,
        target_amount: target || null,
        active,
      };
      return goal
        ? patchJson(`/savings-goals/${goal.id}/`, sharedPayload)
        : postJson("/savings-goals/", {
            ...sharedPayload,
            opening_balance: opening,
          });
    },
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
        Goal name
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Emergency fund"
        />
      </label>
      {!goal && (
        <label>
          Starting reserved balance
          <div className="money-input">
            <span>Rs</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
            />
          </div>
          <small className="field-help">
            Use only for savings already included in your opening bank balance. Record new
            money with Add movement.
          </small>
        </label>
      )}
      <label>
        Target <span className="optional">optional</span>
        <div className="money-input">
          <span>Rs</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="No fixed target"
          />
        </div>
      </label>
      {goal && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          <span>
            Active goal
            <small>Inactive goals remain in your history but can no longer receive new savings.</small>
          </span>
        </label>
      )}
      {mutation.isError && <p className="form-error">Goal names must be unique.</p>}
      <button className="button primary full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : goal ? "Update goal" : "Create goal"}
      </button>
    </form>
  );
}
