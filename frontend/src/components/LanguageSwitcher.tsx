import { useMutation } from "@tanstack/react-query";
import { Languages } from "lucide-react";
import { patchJson } from "../api/client";
import { useI18n, type AppLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { language } = useI18n();
  const nextLanguage: AppLanguage = language === "en" ? "ur" : "en";
  const mutation = useMutation({
    mutationFn: () =>
      patchJson("/preferences/", { preferred_language: nextLanguage }),
    onSuccess: () => window.location.reload(),
  });

  return (
    <button
      className="language-switcher"
      type="button"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      aria-label="Change language"
      title="Change language"
    >
      <Languages size={17} />
      <span>{language === "en" ? "اردو" : "English"}</span>
    </button>
  );
}
