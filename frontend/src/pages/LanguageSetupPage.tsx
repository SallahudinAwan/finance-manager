import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Languages } from "lucide-react";
import { patchJson } from "../api/client";
import { RavaniLogo } from "../components/RavaniMark";
import type { AppLanguage } from "../i18n";
import type { Session } from "../types";

export function LanguageSetupPage({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (preferred_language: AppLanguage) =>
      patchJson("/preferences/", { preferred_language }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  return (
    <main className="language-setup">
      <section className="language-card">
        <a className="landing-brand" href="/">
          <RavaniLogo />
        </a>
        <div className="language-icon"><Languages size={28} /></div>
        <p className="language-kicker">Welcome, {session.user.name.split(" ")[0]}</p>
        <h1>Choose your preferred language</h1>
        <p className="language-urdu-heading" lang="ur" dir="rtl">
          اپنی پسندیدہ زبان منتخب کریں
        </p>
        <p className="language-copy">
          We’ll remember this choice every time you open Ravani. You can change it
          anytime from inside the app.
        </p>
        <div className="language-options">
          <button
            className="language-option"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("en")}
          >
            <span className="language-code">EN</span>
            <span><strong>English</strong><small>Continue in English</small></span>
            <Check size={18} />
          </button>
          <button
            className="language-option urdu-option"
            dir="rtl"
            lang="ur"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("ur")}
          >
            <span className="language-code">اردو</span>
            <span><strong>اردو</strong><small>اردو میں جاری رکھیں</small></span>
            <Check size={18} />
          </button>
        </div>
        {mutation.isError && (
          <p className="form-error">We couldn’t save your choice. Please try again.</p>
        )}
      </section>
    </main>
  );
}
