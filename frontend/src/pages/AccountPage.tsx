import { useMutation, useQuery } from "@tanstack/react-query";
import { Crown, LogOut, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { api, postJson } from "../api/client";
import { ErrorPanel, PageHeader, Skeleton } from "../components/ui";
import type { Session, User } from "../types";
import { useOutletContext } from "react-router-dom";

interface Membership {
  id: number;
  user: User;
  role: "owner" | "member";
  is_active: boolean;
}

export function AccountPage() {
  const { session } = useOutletContext<{ session: Session }>();
  const members = useQuery({
    queryKey: ["household-members"],
    queryFn: () => api<Membership[]>("/household/members/"),
  });
  const transfer = useMutation({
    mutationFn: (membershipId: number) =>
      postJson("/household/transfer-ownership/", { membership_id: membershipId }),
    onSuccess: () => window.location.reload(),
  });
  const leave = useMutation({
    mutationFn: () => postJson("/household/leave/", {}),
    onSuccess: () => {
      window.location.href = "/";
    },
  });
  const deleteAccount = useMutation({
    mutationFn: () => api<void>("/account/", { method: "DELETE" }),
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  if (members.isLoading) return <Skeleton height={460} />;
  if (members.isError || !members.data) return <ErrorPanel />;

  const confirmTransfer = (membership: Membership) => {
    if (
      window.confirm(
        `Transfer ownership to ${membership.user.name}? You will become a household member.`,
      )
    ) {
      transfer.mutate(membership.id);
    }
  };

  const confirmLeave = () => {
    if (window.confirm("Leave this household? Your account remains available for a new household.")) {
      leave.mutate();
    }
  };

  const confirmDelete = () => {
    const warning = session.is_owner
      ? "Delete your account and all household finance data? This cannot be undone."
      : "Delete your account permanently? Your historical entries will remain without your identity.";
    if (window.confirm(warning)) deleteAccount.mutate();
  };

  return (
    <>
      <PageHeader
        eyebrow="Account management"
        title="Your access and household role"
        description="Review membership, transfer ownership safely, or manage your account."
      />

      <div className="settings-grid">
        <article className="panel setting-card">
          <span className="setting-icon">
            <UserRound size={21} />
          </span>
          <div>
            <small>Signed in with Google</small>
            <h2>{session.user.name}</h2>
            <strong className="account-email">{session.user.email}</strong>
            <p>{session.is_owner ? "Household owner" : "Household member"}</p>
          </div>
          <a className="button secondary" href="/accounts/logout/">
            <LogOut size={16} /> Sign out
          </a>
        </article>

        <article className="panel setting-card">
          <span className="setting-icon violet">
            <ShieldCheck size={21} />
          </span>
          <div>
            <small>Privacy policy</small>
            <h2>Private by default</h2>
            <p>
              Members see only their own personal expense details. The owner can include all
              private entries only in an explicit full backup.
            </p>
          </div>
        </article>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">People</span>
            <h2>Household members</h2>
          </div>
          <Users className="muted-icon" size={20} />
        </div>
        <div className="invite-list">
          {members.data.map((membership) => (
            <div className="invite-row" key={membership.id}>
              <span>
                {membership.role === "owner" ? <Crown size={17} /> : <UserRound size={17} />}
              </span>
              <div>
                <strong>{membership.user.name}</strong>
                <small>
                  {membership.user.email} · {membership.role}
                </small>
              </div>
              {session.is_owner && membership.role === "member" && (
                <button
                  className="button secondary small"
                  disabled={transfer.isPending}
                  onClick={() => confirmTransfer(membership)}
                >
                  Make owner
                </button>
              )}
            </div>
          ))}
        </div>
        {transfer.isError && (
          <p className="form-error">Ownership could not be transferred. Please try again.</p>
        )}
      </section>

      <section className="panel danger-zone">
        <div>
          <span className="panel-kicker">Danger zone</span>
          <h2>{session.is_owner ? "Delete household and account" : "Leave or delete account"}</h2>
          <p>
            Owners must transfer ownership while another active member remains. Account deletion
            is permanent.
          </p>
        </div>
        <div className="inline-actions">
          {!session.is_owner && (
            <button className="button secondary" onClick={confirmLeave} disabled={leave.isPending}>
              Leave household
            </button>
          )}
          <button
            className="button danger"
            onClick={confirmDelete}
            disabled={deleteAccount.isPending}
          >
            <Trash2 size={16} /> Delete account
          </button>
        </div>
        {(leave.isError || deleteAccount.isError) && (
          <p className="form-error">
            This action is not available yet. An owner may need to transfer ownership first.
          </p>
        )}
      </section>
    </>
  );
}
