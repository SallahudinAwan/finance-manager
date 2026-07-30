import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SavingsGoal } from "../types";
import { GoalForm } from "./SavingsPage";

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
