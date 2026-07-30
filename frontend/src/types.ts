export type Money = number | string;

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface Household {
  id: number;
  name: string;
  currency: "PKR";
  timezone: "Asia/Karachi";
  monthly_savings_target: Money;
  savings_reminder_day: number;
  onboarding_complete: boolean;
}

export interface Session {
  user: User;
  membership: { role: "owner" | "member"; household_id: number } | null;
  household: Household | null;
  is_owner: boolean;
  needs_onboarding: boolean;
}

export interface PeriodSummary {
  id: number;
  year: number;
  month: number;
  label: string;
  planned_income: Money;
  income_received: Money;
  planned_household: Money;
  household_paid: Money;
  house_balance: Money;
  personal_spent: Money;
  savings_target: Money;
  net_new_savings: Money;
  safe_to_spend: Money;
  net_cash_flow: Money;
}

export interface PlannedExpense {
  id: number;
  name: string;
  expected_amount: Money;
  due_date: string;
  reminder_lead_days: number;
  paid_amount: Money;
  remaining_amount: Money;
  status: "unpaid" | "partial" | "paid" | "overpaid";
}

export interface IncomePlan {
  id: number;
  name: string;
  planned_amount: Money;
  received_amount: Money;
}

export interface Month {
  id: number;
  year: number;
  month: number;
  label: string;
  savings_target: Money;
  income_plans: IncomePlan[];
  planned_expenses: PlannedExpense[];
}

export interface SavingsGoal {
  id: number;
  name: string;
  opening_balance: Money;
  target_amount: Money | null;
  active: boolean;
  balance: Money;
}

export interface Dashboard {
  period: PeriodSummary;
  bank: {
    calculated_balance: Money;
    actual_balance: Money | null;
    variance: Money | null;
    reconciled_at: string | null;
  };
  savings: {
    total: Money;
    goals: Array<{
      id: number;
      name: string;
      balance: Money;
      target_amount: Money | null;
    }>;
    exceeds_bank: boolean;
  };
  unpaid_bills: PlannedExpense[];
}

export interface Trend extends PeriodSummary {
  savings_total: Money;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  message: string;
  action_url: string;
  read_at: string | null;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
