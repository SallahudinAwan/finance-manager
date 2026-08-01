import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { postJson } from "../api/client";
import type { Session } from "../types";

type Income = { name: string; amount: string };
type Expense = {
  name: string;
  expected_amount: string;
  due_day: string;
  reminder_lead_days: string;
};
type Goal = { name: string; opening_balance: string; target_amount: string };

export function OnboardingPage({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState(
    `${session.user.name.split(" ")[0]}'s household`,
  );
  const [bankName, setBankName] = useState("Main Bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingsTarget, setSavingsTarget] = useState("");
  const [incomes, setIncomes] = useState<Income[]>([{ name: "", amount: "" }]);
  const [expenses, setExpenses] = useState<Expense[]>([
    { name: "", expected_amount: "", due_day: "1", reminder_lead_days: "3" },
  ]);
  const [goals, setGoals] = useState<Goal[]>([
    { name: "General savings", opening_balance: "0", target_amount: "" },
  ]);

  const mutation = useMutation({
    mutationFn: () =>
      postJson("/onboarding/", {
        household_name: householdName,
        bank_name: bankName,
        opening_balance: openingBalance,
        opening_date: openingDate,
        monthly_savings_target: savingsTarget || "0",
        incomes: incomes.filter((item) => item.name && item.amount),
        expenses: expenses
          .filter((item) => item.name && item.expected_amount)
          .map((item) => ({
            ...item,
            due_day: Number(item.due_day),
            reminder_lead_days: Number(item.reminder_lead_days),
          })),
        savings_goals: goals
          .filter((item) => item.name)
          .map((item) => ({
            ...item,
            opening_balance: item.opening_balance || "0",
            target_amount: item.target_amount || null,
          })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      window.location.assign("/app");
    },
  });

  return (
    <div className="onboarding">
      <aside>
        <a className="landing-brand" href="/">
          <span><Landmark size={19} /></span> Finance Manager
        </a>
        <div className="onboarding-intro">
          <span>Welcome, {session.user.name.split(" ")[0]}</span>
          <h1>Let’s build your first calm month.</h1>
          <p>This takes about three minutes. You can change every value later.</p>
        </div>
        <ol className="step-list">
          {[
            [1, "Your foundation", "Household and bank"],
            [2, "Monthly plan", "Income and bills"],
            [3, "Protect savings", "Goals and review"],
          ].map(([number, title, copy]) => (
            <li
              key={number}
              className={step === number ? "active" : step > Number(number) ? "done" : ""}
            >
              <span>{step > Number(number) ? <Check size={16} /> : number}</span>
              <div><strong>{title}</strong><small>{copy}</small></div>
            </li>
          ))}
        </ol>
      </aside>
      <main>
        <div className="wizard-card">
          {step === 1 && (
            <>
              <div className="wizard-heading">
                <span><Landmark size={20} /></span>
                <div><small>Step 1 of 3</small><h2>Start with the real balance</h2><p>This becomes the opening point for your calculated bank ledger.</p></div>
              </div>
              <div className="stack-form spacious">
                <label>
                  Household name
                  <input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} />
                </label>
                <label>
                  Bank label
                  <input value={bankName} onChange={(event) => setBankName(event.target.value)} />
                </label>
                <div className="form-grid">
                  <label>
                    Current bank balance
                    <div className="money-input"><span>Rs</span><input required type="number" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} placeholder="0" /></div>
                  </label>
                  <label>
                    Balance date
                    <input type="date" value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} />
                  </label>
                </div>
                <label>
                  Fixed monthly savings target
                  <div className="money-input"><span>Rs</span><input type="number" min="0" step="0.01" value={savingsTarget} onChange={(event) => setSavingsTarget(event.target.value)} placeholder="150,000" /></div>
                  <small className="field-help">This is reserved before calculating safe-to-spend money.</small>
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="wizard-heading">
                <span><ReceiptText size={20} /></span>
                <div><small>Step 2 of 3</small><h2>Shape a normal month</h2><p>These templates create the plan. Actual payments always start at zero.</p></div>
              </div>
              <div className="setup-section">
                <div className="setup-title"><div><Banknote size={18} /><span><strong>Income sources</strong><small>At least one is required</small></span></div><button onClick={() => setIncomes([...incomes, { name: "", amount: "" }])}><Plus size={16} /> Add</button></div>
                {incomes.map((income, index) => (
                  <div className="setup-entry income" key={index}>
                    <label className="setup-field">
                      <span>Income source name</span>
                      <input aria-label="Income source name" value={income.name} onChange={(event) => setIncomes(incomes.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="e.g. Monthly salary" />
                      <small>What should we call this income?</small>
                    </label>
                    <label className="setup-field">
                      <span>Expected monthly income</span>
                      <div className="money-input"><span>Rs</span><input aria-label="Expected monthly income" type="number" min="0.01" step="0.01" value={income.amount} onChange={(event) => setIncomes(incomes.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} placeholder="e.g. 250000" /></div>
                      <small>Enter the amount you normally receive.</small>
                    </label>
                    {incomes.length > 1 && <button type="button" className="icon-button setup-remove" aria-label="Remove income source" onClick={() => setIncomes(incomes.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>}
                  </div>
                ))}
              </div>
              <div className="setup-section">
                <div className="setup-title"><div><ReceiptText size={18} /><span><strong>Household bills</strong><small>Add only recurring planned costs</small></span></div><button onClick={() => setExpenses([...expenses, { name: "", expected_amount: "", due_day: "1", reminder_lead_days: "3" }])}><Plus size={16} /> Add</button></div>
                {expenses.map((expense, index) => (
                  <div className="setup-entry expense" key={index}>
                    <label className="setup-field">
                      <span>Household bill name</span>
                      <input aria-label="Household bill name" value={expense.name} onChange={(event) => setExpenses(expenses.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="e.g. House rent" />
                      <small>What recurring bill is this?</small>
                    </label>
                    <label className="setup-field">
                      <span>Expected monthly bill amount</span>
                      <div className="money-input"><span>Rs</span><input aria-label="Expected monthly bill amount" type="number" min="0.01" step="0.01" value={expense.expected_amount} onChange={(event) => setExpenses(expenses.map((item, itemIndex) => itemIndex === index ? { ...item, expected_amount: event.target.value } : item))} placeholder="e.g. 50000" /></div>
                      <small>How much do you normally expect to pay?</small>
                    </label>
                    <label className="setup-field">
                      <span>Due day of month</span>
                      <input aria-label="Due day of month" type="number" min="1" max="31" value={expense.due_day} onChange={(event) => setExpenses(expenses.map((item, itemIndex) => itemIndex === index ? { ...item, due_day: event.target.value } : item))} />
                      <small>Calendar day 1–31. Short months use their final day.</small>
                    </label>
                    <button type="button" className="icon-button setup-remove" aria-label="Remove household bill" onClick={() => setExpenses(expenses.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="wizard-heading">
                <span><PiggyBank size={20} /></span>
                <div><small>Step 3 of 3</small><h2>Give savings a purpose</h2><p>Opening amounts set your savings baseline; future contributions record new money entering the bank.</p></div>
              </div>
              <div className="setup-section">
                <div className="setup-title"><div><PiggyBank size={18} /><span><strong>Savings goals</strong><small>Targets are optional</small></span></div><button onClick={() => setGoals([...goals, { name: "", opening_balance: "0", target_amount: "" }])}><Plus size={16} /> Add</button></div>
                {goals.map((goal, index) => (
                  <div className="setup-entry goal" key={index}>
                    <label className="setup-field">
                      <span>Savings goal name</span>
                      <input aria-label="Savings goal name" value={goal.name} onChange={(event) => setGoals(goals.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="e.g. Emergency fund" />
                      <small>What are you saving this money for?</small>
                    </label>
                    <label className="setup-field">
                      <span>Amount already saved</span>
                      <div className="money-input"><span>Rs</span><input aria-label="Amount already saved" type="number" min="0" step="0.01" value={goal.opening_balance} onChange={(event) => setGoals(goals.map((item, itemIndex) => itemIndex === index ? { ...item, opening_balance: event.target.value } : item))} /></div>
                      <small>Only money already included in your bank balance.</small>
                    </label>
                    <label className="setup-field">
                      <span>Goal target</span>
                      <div className="money-input"><span>Rs</span><input aria-label="Goal target" type="number" min="0.01" step="0.01" value={goal.target_amount} onChange={(event) => setGoals(goals.map((item, itemIndex) => itemIndex === index ? { ...item, target_amount: event.target.value } : item))} placeholder="Optional" /></div>
                      <small>Optional total amount you want to reach.</small>
                    </label>
                    <button type="button" className="icon-button setup-remove" aria-label="Remove savings goal" onClick={() => setGoals(goals.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="review-strip">
                <div><span>Income sources</span><strong>{incomes.filter((item) => item.name).length}</strong></div>
                <div><span>Recurring bills</span><strong>{expenses.filter((item) => item.name).length}</strong></div>
                <div><span>Savings goals</span><strong>{goals.filter((item) => item.name).length}</strong></div>
              </div>
              {mutation.isError && <p className="form-error">Please review required fields and unique goal names.</p>}
            </>
          )}

          <div className="wizard-actions">
            {step > 1 ? <button className="button secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={17} /> Back</button> : <span />}
            {step < 3 ? (
              <button className="button primary" disabled={step === 1 && (!householdName || !openingBalance) || step === 2 && !incomes.some((item) => item.name && item.amount)} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={17} /></button>
            ) : (
              <button className="button primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Creating your household…" : "Open my dashboard"} <ArrowRight size={17} /></button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
