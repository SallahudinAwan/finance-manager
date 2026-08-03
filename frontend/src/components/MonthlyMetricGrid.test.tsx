import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Dashboard } from "../types";
import { MonthlyMetricGrid } from "./MonthlyMetricGrid";

const dashboard: Dashboard = {
  period: {
    id: 4,
    year: 2026,
    month: 8,
    label: "2026-08",
    planned_income: "500000.00",
    income_received: "500000.00",
    planned_household: "120000.00",
    household_paid: "80000.00",
    house_balance: "40000.00",
    personal_spent: "30000.00",
    savings_target: "150000.00",
    safe_to_spend_carryover: "0.00",
    net_new_savings: "150000.00",
    safe_to_spend: "200000.00",
    net_cash_flow: "390000.00",
  },
  bank: {
    calculated_balance: "829980.00",
    actual_balance: null,
    variance: null,
    reconciled_at: null,
  },
  savings: {
    total: "250000.00",
    goals: [],
    exceeds_bank: false,
  },
  unpaid_bills: [],
};

describe("MonthlyMetricGrid", () => {
  it("shows the four key monthly figures", () => {
    render(<MonthlyMetricGrid data={dashboard} />);

    const summary = screen.getByRole("region", { name: "Monthly financial summary" });
    expect(within(summary).getByText("Safe to spend")).toBeVisible();
    expect(within(summary).getByText("Calculated bank")).toBeVisible();
    expect(within(summary).getByText("House balance")).toBeVisible();
    expect(within(summary).getByText("Savings reserved")).toBeVisible();
    expect(within(summary).getByText("100% of this month’s target")).toBeVisible();
  });
});
