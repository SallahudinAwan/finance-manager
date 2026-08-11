export function todayDateValue(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function defaultTransactionDate(monthLabel: string, today = new Date()): string {
  const todayLabel = todayDateValue(today);
  return todayLabel.startsWith(`${monthLabel}-`) ? todayLabel : `${monthLabel}-01`;
}
