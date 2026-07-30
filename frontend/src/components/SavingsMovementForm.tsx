import { useMutation } from "@tanstack/react-query";
import { CirclePlus } from "lucide-react";
import { useState } from "react";
import { formatPkr, postJson } from "../api/client";
import type { SavingsGoal } from "../types";

export function SavingsMovementForm({
  goals,
  period,
  defaultDate,
  onSaved,
}: {
  goals: SavingsGoal[];
  period: number;
  defaultDate: string;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"contribution" | "withdrawal" | "transfer">(
    "contribution",
  );
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState(goals[0]?.id.toString() ?? "");
  const [dateValue, setDateValue] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      postJson("/savings-movements/", {
        period,
        kind,
        source_goal: kind === "contribution" ? null : Number(source),
        destination_goal: kind === "withdrawal" ? null : Number(destination),
        date: dateValue,
        amount,
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
      <div className="segmented">
        {(["contribution", "withdrawal", "transfer"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={kind === value ? "active" : ""}
            onClick={() => setKind(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {kind !== "contribution" && (
        <label>
          From
          <select required value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">Choose a goal</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name} · {formatPkr(goal.balance)}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind !== "withdrawal" && (
        <label>
          To
          <select
            required
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            <option value="">Choose a goal</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      )}
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
          />
        </div>
      </label>
      <label>
        Notes <span className="optional">optional</span>
        <input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {mutation.isError && (
        <p className="form-error">Check the selected goals, date, and available amount.</p>
      )}
      <button className="button primary full" disabled={mutation.isPending}>
        <CirclePlus size={17} /> Save movement
      </button>
    </form>
  );
}
