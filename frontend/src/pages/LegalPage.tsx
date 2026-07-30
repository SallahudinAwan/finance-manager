import { ArrowLeft, Landmark } from "lucide-react";

const content = {
  privacy: {
    title: "Privacy policy",
    intro: "Finance Manager stores only the information needed to run your household workspace.",
    sections: [
      [
        "What we collect",
        "Your Google account identifier, name, and email; the finance records you enter; household membership; and operational audit data.",
      ],
      [
        "How household privacy works",
        "Personal expense details are visible only to their creator. Shared dashboards expose a combined personal-spending total without member identity. A household owner may include all private entries only by explicitly downloading a full backup.",
      ],
      [
        "Services",
        "Production hosting uses Render, database storage uses Neon PostgreSQL, Google provides authentication, and Resend may deliver transactional email.",
      ],
      [
        "Your choices",
        "You can export your data from Reports and delete your account from Account. Owners must transfer ownership first when another member remains.",
      ],
    ],
  },
  terms: {
    title: "Terms of use",
    intro: "Finance Manager is a planning and record-keeping tool, not financial advice.",
    sections: [
      [
        "Your records",
        "You are responsible for the accuracy of the amounts you enter and for reconciling them with your bank. Savings contributions and withdrawals are treated as bank cash flow; transfers between goals are bank-neutral.",
      ],
      [
        "Acceptable use",
        "Do not attempt to access another household, disrupt the service, or use it for unlawful activity.",
      ],
      [
        "Availability",
        "Preview deployments may use infrastructure that sleeps when idle. Keep periodic exports of information you cannot afford to lose.",
      ],
    ],
  },
  "data-deletion": {
    title: "Data deletion",
    intro: "You can remove your account from the Account page after signing in.",
    sections: [
      [
        "Members",
        "Leaving a household removes your access. Deleting your Google-linked account is permanent; historical ledger records may remain without your identity so the household totals stay correct.",
      ],
      [
        "Owners",
        "If members remain, transfer ownership before deleting your account. A sole owner deleting their account also permanently deletes the household and its finance records.",
      ],
      [
        "Before deleting",
        "Download the appropriate CSV or JSON export first. Finance Manager v1 does not include backup restoration.",
      ],
    ],
  },
} as const;

export function LegalPage({ kind }: { kind: keyof typeof content }) {
  const page = content[kind];
  return (
    <div className="legal-page">
      <header className="landing-nav">
        <a className="landing-brand" href="/">
          <span>
            <Landmark size={19} />
          </span>
          Finance Manager
        </a>
        <a className="button secondary" href="/">
          <ArrowLeft size={16} /> Back
        </a>
      </header>
      <main>
        <span className="eyebrow">Finance Manager</span>
        <h1>{page.title}</h1>
        <p className="legal-intro">{page.intro}</p>
        {page.sections.map(([title, copy]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{copy}</p>
          </section>
        ))}
        <small>Last updated: July 30, 2026</small>
      </main>
    </div>
  );
}
