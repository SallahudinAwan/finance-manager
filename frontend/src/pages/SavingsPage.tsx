import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, PiggyBank, Plus, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, formatPkr, money, postJson } from "../api/client";
import { Modal } from "../components/Modal";
import { SavingsMovementForm } from "../components/SavingsMovementForm";
import { EmptyState, ErrorPanel, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import type { Month, Paginated, SavingsGoal, Session } from "../types";

export function SavingsPage() {
  const { session } = useOutletContext<{ session: Session }>();
  const queryClient = useQueryClient();
  const [movementOpen, setMovementOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const goals = useQuery({
    queryKey: ["savings-goals"],
    queryFn: () => api<Paginated<SavingsGoal>>("/savings-goals/"),
  });
  const month = useQuery({
    queryKey: ["month", "current"],
    queryFn: () => api<Month>("/months/current/"),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["savings-goals"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["trends"] }),
    ]);
  };

  if (goals.isLoading || month.isLoading) return <Skeleton height={540} />;
  if (goals.isError || month.isError || !goals.data || !month.data) return <ErrorPanel />;

  const total = goals.data.results.reduce((sum, goal) => sum + money(goal.balance), 0);

  return (
    <>
      <PageHeader
        eyebrow="Virtual envelopes"
        title="Savings that have a purpose"
        description="Every rupee stays in your bank account while goals make sure it is not accidentally spent."
        actions={
          session.is_owner ? (
            <>
              <Modal
                title="Move savings"
                description="Contributions and withdrawals change what is reserved, not the bank ledger."
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
            </>
          ) : undefined
        }
      />

      <section className="savings-hero">
        <div>
          <span>Total reserved</span>
          <strong>{formatPkr(total)}</strong>
          <p>Across {goals.data.results.length} active savings envelopes</p>
        </div>
        <div className="savings-hero-icon">
          <PiggyBank size={38} />
        </div>
      </section>

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
                  <span className="active-pill">Active</span>
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
    </>
  );
}
function GoalForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("0");
  const [target, setTarget] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      postJson("/savings-goals/", {
        name,
        opening_balance: opening,
        target_amount: target || null,
        active: true,
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
        Goal name
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Emergency fund"
        />
      </label>
      <label>
        Already reserved
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
      </label>
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
      {mutation.isError && <p className="form-error">Goal names must be unique.</p>}
      <button className="button primary full" disabled={mutation.isPending}>
        Create goal
      </button>
    </form>
  );
}
