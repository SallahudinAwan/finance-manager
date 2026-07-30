import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlannedExpense } from "../types";
import { HouseholdPaymentSummary } from "./MonthPage";

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
