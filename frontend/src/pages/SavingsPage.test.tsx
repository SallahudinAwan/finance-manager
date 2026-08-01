import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SavingsGoal, SavingsMovement } from "../types";
import { GoalForm, SavingsTransactionHistory } from "./SavingsPage";

const goal: SavingsGoal = {
  id: 12,
  name: "Emergency",
  opening_balance: "10000.00",
  target_amount: "100000.00",
  active: true,
  balance: "30000.00",
};

describe("GoalForm", () => {
  it("loads and updates an existing savings goal", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...goal, name: "Emergency fund" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GoalForm goal={goal} onSaved={onSaved} />
      </QueryClientProvider>,
    );

    const name = screen.getByLabelText("Goal name");
    expect(name).toHaveValue("Emergency");
    fireEvent.change(name, { target: { value: "Emergency fund" } });
    fireEvent.click(screen.getByRole("button", { name: "Update goal" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/savings-goals/12/",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Emergency fund",
          target_amount: "100000.00",
          active: true,
        }),
      }),
    );
  });
});

describe("SavingsTransactionHistory", () => {
  it("shows credited and debited amounts against their savings goals", () => {
    const travel: SavingsGoal = {
      ...goal,
      id: 13,
      name: "Travel",
      opening_balance: "0.00",
      balance: "2000.00",
    };
    const movements: SavingsMovement[] = [
      {
        id: 1,
        period: 8,
        kind: "contribution",
        source_goal: null,
        destination_goal: goal.id,
        date: "2026-08-03",
        amount: "5000.00",
        notes: "Family gift",
        rollover_allocation: null,
        created_at: "2026-08-03T10:00:00Z",
      },
      {
        id: 2,
        period: 8,
        kind: "transfer",
        source_goal: goal.id,
        destination_goal: travel.id,
        date: "2026-08-05",
        amount: "2000.00",
        notes: "Trip planning",
        rollover_allocation: null,
        created_at: "2026-08-05T10:00:00Z",
      },
    ];

    render(
      <SavingsTransactionHistory
        goals={[goal, travel]}
        movements={movements}
        totalCount={2}
      />,
    );

    expect(screen.getByRole("heading", { name: "Credits and debits" })).toBeVisible();
    const transferRow = screen.getByText("Emergency → Travel").closest("tr");
    expect(transferRow).not.toBeNull();
    expect(within(transferRow!).getByText("Travel")).toBeVisible();
    expect(within(transferRow!).getByText("Emergency")).toBeVisible();
    expect(
      within(transferRow!).getAllByText((content) => content.includes("2,000")),
    ).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Filter by goal"), {
      target: { value: String(travel.id) },
    });
    expect(screen.queryByText("Family gift")).not.toBeInTheDocument();
    expect(screen.getByText("Trip planning")).toBeVisible();
  });
});
