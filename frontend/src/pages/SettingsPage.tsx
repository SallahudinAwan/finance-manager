import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Banknote,
  CalendarClock,
  Copy,
  MailPlus,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, appLocale, formatPkr, postJson } from "../api/client";
import { Modal } from "../components/Modal";
import { ErrorPanel, PageHeader, Skeleton } from "../components/ui";
import type { Paginated, Session } from "../types";

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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [templateType, setTemplateType] = useState<"income" | "expense" | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["income-templates"] }),
      queryClient.invalidateQueries({ queryKey: ["expense-templates"] }),
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
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

      <section className="settings-grid">
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
        </article>
      </section>

      {session.is_owner ? (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Monthly generator</span>
                <h2>Recurring plan</h2>
              </div>
              <div className="inline-actions">
                <button className="button secondary small" onClick={() => setTemplateType("income")}>
                  <Plus size={15} /> Income
                </button>
                <button
                  className="button secondary small"
                  onClick={() => setTemplateType("expense")}
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
        title={templateType === "income" ? "Add recurring income" : "Add recurring expense"}
        trigger={<span />}
        open={templateType !== null}
        onOpenChange={(open) => !open && setTemplateType(null)}
      >
        {templateType && (
          <TemplateForm
            type={templateType}
            onSaved={async () => {
              setTemplateType(null);
              await refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}
function ReconcileForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [postAdjustment, setPostAdjustment] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      postJson("/bank/reconciliations/", {
        date: new Date().toISOString().slice(0, 10),
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
  onSaved,
}: {
  type: "income" | "expense";
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [lead, setLead] = useState("3");
  const mutation = useMutation({
    mutationFn: () =>
      postJson(type === "income" ? "/income-templates/" : "/expense-templates/", {
        name,
        ...(type === "income"
          ? { amount }
          : {
              expected_amount: amount,
              due_day: Number(dueDay),
              reminder_lead_days: Number(lead),
            }),
        active: true,
      }),
    onSuccess: onSaved,
  });
  return (
    <form className="stack-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <label>
        Name
        <input required value={name} onChange={(event) => setName(event.target.value)} placeholder={type === "income" ? "Monthly salary" : "Rent"} />
      </label>
      <label>
        {type === "income" ? "Planned amount" : "Expected amount"}
        <div className="money-input">
          <span>Rs</span>
          <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
      </label>
      {type === "expense" && (
        <div className="form-grid">
          <label>
            Due day
            <input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
          </label>
          <label>
            Remind before
            <input type="number" min="0" max="31" value={lead} onChange={(event) => setLead(event.target.value)} />
          </label>
        </div>
      )}
      {mutation.isError && <p className="form-error">Please check the values.</p>}
      <button className="button primary full" disabled={mutation.isPending}>Add to future months</button>
    </form>
  );
}
