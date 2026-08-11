import { arrayMove } from "@dnd-kit/sortable";
import type { PlannedExpense } from "../types";

const expenseStatusPriority: Record<PlannedExpense["status"], number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
  overpaid: 2,
};

export function expensePriorityGroup(
  expense: PlannedExpense,
): "unpaid" | "partial" | "settled" {
  if (expense.status === "unpaid") return "unpaid";
  if (expense.status === "partial") return "partial";
  return "settled";
}

export function sortPlannedExpenses(expenses: PlannedExpense[]): PlannedExpense[] {
  return [...expenses].sort(
    (left, right) =>
      expenseStatusPriority[left.status] - expenseStatusPriority[right.status]
      || left.display_order - right.display_order
      || left.due_date.localeCompare(right.due_date)
      || left.id - right.id,
  );
}

export function reorderExpensesWithinStatus(
  expenses: PlannedExpense[],
  activeId: number,
  overId: number,
): PlannedExpense[] {
  const ordered = sortPlannedExpenses(expenses);
  const activeExpense = ordered.find((expense) => expense.id === activeId);
  const overExpense = ordered.find((expense) => expense.id === overId);
  if (
    !activeExpense
    || !overExpense
    || expensePriorityGroup(activeExpense) !== expensePriorityGroup(overExpense)
  ) {
    return ordered;
  }
  const group = expensePriorityGroup(activeExpense);
  const groupExpenses = ordered.filter((expense) => expensePriorityGroup(expense) === group);
  const fromIndex = groupExpenses.findIndex((expense) => expense.id === activeId);
  const toIndex = groupExpenses.findIndex((expense) => expense.id === overId);
  const reorderedGroup = arrayMove(groupExpenses, fromIndex, toIndex);
  let groupIndex = 0;
  return ordered.map((expense) =>
    expensePriorityGroup(expense) === group ? reorderedGroup[groupIndex++] : expense,
  );
}

export function defaultTransactionDate(monthLabel: string, today = new Date()): string {
  const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return todayLabel.startsWith(`${monthLabel}-`) ? todayLabel : `${monthLabel}-01`;
}
