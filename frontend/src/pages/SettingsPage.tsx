import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Banknote,
  CalendarClock,
  Copy,
  MailPlus,
  Pencil,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, appLocale, formatPkr, patchJson, postJson } from "../api/client";
import { Modal } from "../components/Modal";
import { ErrorPanel, PageHeader, Skeleton } from "../components/ui";
import type { Money, Paginated, Session } from "../types";
import { todayDateValue } from "../utils/dates";

interface Bank {
  id: number;
  name: string;
  opening_balance: number | string;
  opening_date: string;
  calculated_balance: number | string;
}

interface Template {
  id: number;
  name: string;
  amount?: number | string;
  expected_amount?: number | string;
  due_day?: number;
  reminder_lead_days?: number;
  active: boolean;
}

interface Invite {
  id: number;
  email: string;
  status: string;
  invite_url: string;
  expires_at: string;
}

export function SettingsPage() {
  const { session } = useOutletContext<{ session: Session }>();
  const queryClient = useQueryClient();
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [savingsTargetOpen, setSavingsTargetOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [templateEditor, setTemplateEditor] = useState<{
    type: "income" | "expense";
    template?: Template;
  } | null>(null);
  const bank = useQuery({ queryKey: ["bank"], queryFn: () => api<Bank>("/bank/") });
  const incomes = useQuery({
    queryKey: ["income-templates"],
    queryFn: () => api<Paginated<Template>>("/income-templates/"),
    enabled: session.is_owner,
  });
  const expenses = useQuery({
    queryKey: ["expense-templates"],
    queryFn: () => api<Paginated<Template>>("/expense-templates/"),
    enabled: session.is_owner,
  });
  const invites = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api<Paginated<Invite>>("/invitations/"),
    enabled: session.is_owner,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bank"] }),
      queryClient.invalidateQueries({ queryKey: ["session"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["income-templates"] }),
      queryClient.invalidateQueries({ queryKey: ["expense-templates"] }),
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
      queryClient.invalidateQueries({ queryKey: ["month"] }),
      queryClient.invalidateQueries({ queryKey: ["months"] }),
      queryClient.invalidateQueries({ queryKey: ["trends"] }),
      queryClient.invalidateQueries({ queryKey: ["savings-goals"] }),
      queryClient.invalidateQueries({ queryKey: ["savings-movements"] }),
    ]);
  };

  if (bank.isLoading) return <Skeleton height={500} />;
  if (bank.isError || !bank.data) return <ErrorPanel />;

  return (
    <>
      <PageHeader
        eyebrow="Household settings"
        title="The rules behind your monthly plan"
        description="Opening balances, recurring items, invitations, and reconciliation live here."
      />

      <section className="settings-grid" data-tour="settings-bank">
        <article className="panel setting-card">
          <span className="setting-icon">
            <Banknote size={21} />
          </span>
          <div>
            <small>Tracked bank account</small>
            <h2>{bank.data.name}</h2>
            <strong>{formatPkr(bank.data.calculated_balance)}</strong>
            <p>
              Opened in the app on{" "}
              {new Date(`${bank.data.opening_date}T00:00:00`).toLocaleDateString(appLocale())}
            </p>
          </div>
          {session.is_owner && (
            <Modal
              title="Reconcile your bank"
              description="Enter the balance shown by your bank. Adjustments are never posted silently."
              trigger={
                <button className="button secondary">
                  <ArrowUpDown size={16} /> Reconcile
                </button>
              }
              open={reconcileOpen}
              onOpenChange={setReconcileOpen}
            >
              <ReconcileForm
                onSaved={async () => {
                  setReconcileOpen(false);
                  await refresh();
                }}
              />
            </Modal>
          )}
        </article>

        <article className="panel setting-card">
          <span className="setting-icon violet">
            <Settings2 size={21} />
          </span>
          <div>
            <small>Household</small>
            <h2>{session.household?.name}</h2>
            <strong>{formatPkr(session.household?.monthly_savings_target)}</strong>
            <p>Monthly savings target · PKR · Asia/Karachi</p>
          </div>
          {session.is_owner && (
            <Modal
              title="Edit monthly savings"
              description="This updates the recurring target and the newest active month. Earlier months stay unchanged, and savings remain an internal bank-neutral allocation."
              trigger={
                <button className="button secondary">
                  <Pencil size={16} /> Edit savings
                </button>
              }
              open={savingsTargetOpen}
              onOpenChange={setSavingsTargetOpen}
            >
              <SavingsTargetForm
                target={session.household?.monthly_savings_target ?? "0"}
                onSaved={async () => {
                  setSavingsTargetOpen(false);
                  await refresh();
                }}
              />
            </Modal>
          )}
        </article>
      </section>

      {session.is_owner ? (
        <>
          <section className="panel" data-tour="settings-recurring">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Monthly generator</span>
                <h2>Recurring plan</h2>
              </div>
              <div className="inline-actions">
                <button className="button secondary small" onClick={() => setTemplateEditor({ type: "income" })}>
                  <Plus size={15} /> Income
                </button>
                <button
                  className="button secondary small"
                  onClick={() => setTemplateEditor({ type: "expense" })}
                >
                  <Plus size={15} /> Expense
                </button>
              </div>
            </div>
            <div className="template-columns">
              <div>
                <h3>Income sources</h3>
                {(incomes.data?.results ?? []).map((item) => (
                  <div className="template-row" key={item.id}>
                    <span className="template-icon income">
                      <Banknote size={16} />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>Copied into each new month</small>
                    </div>
                    <b>{formatPkr(item.amount)}</b>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => setTemplateEditor({ type: "income", template: item })}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <h3>Household bills</h3>
                {(expenses.data?.results ?? []).map((item) => (
                  <div className="template-row" key={item.id}>
                    <span className="template-icon expense">
                      <CalendarClock size={16} />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>Due day {item.due_day} · {item.reminder_lead_days} days notice</small>
                    </div>
                    <b>{formatPkr(item.expected_amount)}</b>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => setTemplateEditor({ type: "expense", template: item })}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Household access</span>
                <h2>Invitations</h2>
              </div>
              <Modal
                title="Invite a household member"
                description="They must sign in with this exact Google email and cannot already belong to another household."
                trigger={
                  <button className="button primary small">
                    <MailPlus size={16} /> Invite
                  </button>
                }
                open={inviteOpen}
                onOpenChange={setInviteOpen}
              >
                <InviteForm
                  onSaved={async () => {
                    setInviteOpen(false);
                    await refresh();
                  }}
                />
              </Modal>
            </div>
            {(invites.data?.results ?? []).length ? (
              <div className="invite-list">
                {invites.data?.results.map((invite) => (
                  <div className="invite-row" key={invite.id}>
                    <span>
                      <Users size={17} />
                    </span>
                    <div>
                      <strong>{invite.email}</strong>
                      <small>
                        {invite.status} · expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString(appLocale())}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Copy invitation link"
                      onClick={() => navigator.clipboard.writeText(invite.invite_url)}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-copy">No pending invitations. You can always copy a link if email is in test mode.</p>
            )}
          </section>
        </>
      ) : (
        <div className="callout neutral">
          <Users size={19} />
          <div>
            <strong>Member access</strong>
            <span>You can view household summaries and manage your private spending. Shared plan changes remain with the owner.</span>
          </div>
        </div>
      )}

      <Modal
        title={
          templateEditor?.template
            ? templateEditor.type === "income"
              ? "Edit income source"
              : "Edit household bill"
            : templateEditor?.type === "income"
              ? "Add recurring income"
              : "Add recurring expense"
        }
        description={
          templateEditor?.template
            ? "Your edit updates the recurring plan and its matching item in the newest month. Earlier months stay unchanged."
            : undefined
        }
        trigger={<span />}
        open={templateEditor !== null}
        onOpenChange={(open) => !open && setTemplateEditor(null)}
      >
        {templateEditor && (
          <TemplateForm
            key={`${templateEditor.type}-${templateEditor.template?.id ?? "new"}`}
            type={templateEditor.type}
            template={templateEditor.template}
            onSaved={async () => {
              setTemplateEditor(null);
              await refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}
export function SavingsTargetForm({
  target,
  onSaved,
}: {
  target: Money;
  onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(target));
  const mutation = useMutation({
    mutationFn: () => patchJson("/household/", { monthly_savings_target: amount }),
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
      <label>
        Fixed monthly savings target
        <div className="money-input">
          <span>Rs</span>
          <input
            aria-label="Fixed monthly savings target"
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <small className="field-help">
          This amount is reserved internally when income is received. It does not create a
          second bank transaction.
        </small>
      </label>
      {mutation.isError && (
        <p className="form-error">Please enter a valid monthly savings amount.</p>
      )}
      <button className="button primary full" disabled={mutation.isPending}>
        {mutation.isPending ? "Updating…" : "Update monthly savings"}
      </button>
    </form>
  );
}
function ReconcileForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [postAdjustment, setPostAdjustment] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      postJson("/bank/reconciliations/", {
        date: todayDateValue(),
        actual_balance: actual,
        notes,
        post_adjustment: postAdjustment,
      }),
    onSuccess: onSaved,
  });
  return (
    <form className="stack-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <label>
        Actual balance
        <div className="money-input">
          <span>Rs</span>
          <input required type="number" step="0.01" value={actual} onChange={(event) => setActual(event.target.value)} />
        </div>
      </label>
      <label>
        Reason or note <span className="optional">recommended</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={postAdjustment} onChange={(event) => setPostAdjustment(event.target.checked)} />
        <span>
          <strong>Post the difference as an adjustment</strong>
          <small>Leave off to keep the variance visible without changing the ledger.</small>
        </span>
      </label>
      {mutation.isError && <p className="form-error">Could not record this reconciliation.</p>}
      <button className="button primary full" disabled={mutation.isPending}>Save reconciliation</button>
    </form>
  );
}

function InviteForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const mutation = useMutation({
    mutationFn: () => postJson("/invitations/", { email }),
    onSuccess: onSaved,
  });
  return (
    <form className="stack-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <label>
        Google account email
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@gmail.com" />
      </label>
      {mutation.isError && <p className="form-error">A pending invitation may already exist.</p>}
      <button className="button primary full" disabled={mutation.isPending}>Create invitation</button>
    </form>
  );
}

function TemplateForm({
  type,
  template,
  onSaved,
}: {
  type: "income" | "expense";
  template?: Template;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [amount, setAmount] = useState(
    String(type === "income" ? (template?.amount ?? "") : (template?.expected_amount ?? "")),
  );
  const [dueDay, setDueDay] = useState(String(template?.due_day ?? 1));
  const [lead, setLead] = useState(String(template?.reminder_lead_days ?? 3));
  const mutation = useMutation({
    mutationFn: () => {
      const path = type === "income" ? "/income-templates/" : "/expense-templates/";
      const body = {
        name,
        ...(type === "income"
          ? { amount }
          : {
              expected_amount: amount,
              due_day: Number(dueDay),
              reminder_lead_days: Number(lead),
            }),
        active: template?.active ?? true,
      };
      return template ? patchJson(`${path}${template.id}/`, body) : postJson(path, body);
    },
    onSuccess: onSaved,
  });
  return (
    <form className="stack-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <label>
        {type === "income" ? "Income source name" : "Household bill name"}
        <input required value={name} onChange={(event) => setName(event.target.value)} placeholder={type === "income" ? "Monthly salary" : "Rent"} />
        <small className="field-help">
          {type === "income" ? "For example: Salary, freelance, or pension." : "For example: Rent, electricity, or internet."}
        </small>
      </label>
      <label>
        {type === "income" ? "Expected monthly income" : "Expected monthly bill amount"}
        <div className="money-input">
          <span>Rs</span>
          <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
      </label>
      {type === "expense" && (
        <div className="form-grid">
          <label>
            Due day of month
            <input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
            <small className="field-help">The calendar day this bill is normally due.</small>
          </label>
          <label>
            Reminder lead time (days)
            <input type="number" min="0" max="31" value={lead} onChange={(event) => setLead(event.target.value)} />
            <small className="field-help">How many days before the due date to remind you.</small>
          </label>
        </div>
      )}
      {mutation.isError && <p className="form-error">Please check the values.</p>}
      <button className="button primary full" disabled={mutation.isPending}>
        {mutation.isPending
          ? template ? "Updating…" : "Saving…"
          : template ? "Update recurring plan" : "Add to future months"}
      </button>
    </form>
  );
}
