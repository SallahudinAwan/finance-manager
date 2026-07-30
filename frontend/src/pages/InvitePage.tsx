import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { postJson } from "../api/client";

export function InvitePage() {
  const { token } = useParams();
  const mutation = useMutation({
    mutationFn: () => postJson(`/invitations/${token}/accept/`, {}),
  });
  return (
    <div className="center-page">
      <div className="auth-card">
        <span className="auth-icon">{mutation.isSuccess ? <CheckCircle2 size={28} /> : <Users size={28} />}</span>
        <h1>{mutation.isSuccess ? "Welcome to the household" : "Join this household"}</h1>
        <p>
          {mutation.isSuccess
            ? "Your private spending stays private while shared totals keep the household plan accurate."
            : "Accepting uses your verified Google email and links this account to one household."}
        </p>
        {mutation.isError && <p className="form-error">This invitation is invalid, expired, or belongs to another Google email.</p>}
        {mutation.isSuccess ? (
          <Link className="button primary full" to="/app">Open dashboard <ArrowRight size={17} /></Link>
        ) : (
          <button className="button primary full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Joining…" : "Accept invitation"}
          </button>
        )}
      </div>
    </div>
  );
}
