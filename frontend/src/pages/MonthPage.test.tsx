import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlannedExpense } from "../types";
import { AddMonthForm, HouseholdPaymentSummary } from "./MonthPage";

const expense: PlannedExpense = {
  id: 7,
  name: "House rent",
  expected_amount: "25000.00",
  due_date: "2026-07-05",
  reminder_lead_days: 3,
  actual_paid_amount: "5000.00",
  carryover_credit: "2000.00",
  paid_amount: "7000.00",
  remaining_amount: "18000.00",
  overpaid_amount: "0.00",
  status: "partial",
};

describe("HouseholdPaymentSummary", () => {
  it("identifies the bill and explains its expected and remaining amounts", () => {
    document.documentElement.lang = "en";
    render(<HouseholdPaymentSummary expense={expense} />);

    const summary = screen.getByRole("region", { name: "Payment details" });
    expect(within(summary).getByText("House rent")).toBeVisible();
    expect(within(summary).getByText("Expected total")).toBeVisible();
    expect(within(summary).getByText("Paid so far")).toBeVisible();
    expect(within(summary).getByText("Remaining to pay")).toBeVisible();
    expect(within(summary).getByText("Rs 25,000")).toBeVisible();
    expect(within(summary).getByText("Rs 7,000")).toBeVisible();
    expect(within(summary).getByText("Rs 18,000")).toBeVisible();
    expect(within(summary).getByText("Rs 2,000 carried forward")).toBeVisible();
  });
});

describe("AddMonthForm", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks where fixed savings and previous-month leftovers should go", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            source_month: "2026-07",
            unpaid_expenses: [{ id: 7, name: "Rent", remaining_amount: "10000.00" }],
            safe_to_spend: "25000.00",
            fixed_savings_target: "15000.00",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 8,
            year: 2026,
            month: 8,
            label: "2026-08",
            savings_target: "0.00",
            safe_to_spend_carryover: "0.00",
            income_plans: [],
            planned_expenses: [],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
    const onCreated = vi.fn(async () => undefined);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AddMonthForm
          goals={[
            {
              id: 3,
              name: "Others",
              opening_balance: "0.00",
              target_amount: null,
              active: true,
              balance: "0.00",
            },
          ]}
          onCreated={onCreated}
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-08" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Unpaid household amounts")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Savings goal for fixed savings"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("What should happen to this amount?"), {
      target: { value: "savings" },
    });
    fireEvent.change(screen.getByLabelText("Savings goal"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Create month and apply choices" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      year: 2026,
      month: 8,
      rollover: {
        bill_allocations: [{ planned_expense: 7, destination_goal: 3 }],
        safe_to_spend: { action: "savings", destination_goal: 3 },
        fixed_savings_goal: 3,
      },
    });
  });

  it("creates the first month without asking for a fixed-savings transfer", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            source_month: null,
            unpaid_expenses: [],
            safe_to_spend: "0.00",
            fixed_savings_target: "0.00",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 8,
            year: 2026,
            month: 8,
            label: "2026-08",
            savings_target: "150000.00",
            safe_to_spend_carryover: "0.00",
            income_plans: [],
            planned_expenses: [],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
    const onCreated = vi.fn(async () => undefined);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AddMonthForm goals={[]} onCreated={onCreated} />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-08" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(screen.queryByText("Fixed monthly savings")).not.toBeInTheDocument();
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({ year: 2026, month: 8 });
  });
});
