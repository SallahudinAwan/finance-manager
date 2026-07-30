import {
  ArrowRight,
  BarChart3,
  Check,
  Landmark,
  LockKeyhole,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

export function LandingPage() {
  const next = encodeURIComponent(window.location.pathname);
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="/">
          <span>
            <Landmark size={19} />
          </span>
          Finance Manager
        </a>
        <a
          className="button secondary"
          href={`/accounts/google/login/?process=login&next=${next}`}
        >
          Sign in
        </a>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-badge">
              <Sparkles size={15} /> Built for real household money
            </span>
            <h1>
              Know what is safe to spend.
              <em> Protect what matters.</em>
            </h1>
            <p>
              Plan monthly bills, keep personal spending private, grow savings,
              and reconcile the balance your bank actually shows.
            </p>
            <div className="hero-actions">
              <a
                className="button primary large"
                href={`/accounts/google/login/?process=login&next=${next}`}
              >
                Continue with Google <ArrowRight size={18} />
              </a>
              <span>
                <ShieldCheck size={16} /> Free to start · PKR
              </span>
            </div>
            <div className="hero-points">
              <span><Check size={15} /> No bank connection required</span>
              <span><Check size={15} /> Private member expenses</span>
              <span><Check size={15} /> Export your data anytime</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="Finance Manager dashboard preview">
            <div className="preview-window">
              <div className="preview-top">
                <span className="preview-logo"><Landmark size={14} /></span>
                <b>August overview</b>
                <span className="preview-avatar">SA</span>
              </div>
              <div className="preview-metrics">
                <div>
                  <small>Safe to spend</small>
                  <strong>Rs276,000</strong>
                  <span className="up">After plans & savings</span>
                </div>
                <div>
                  <small>Bank balance</small>
                  <strong>Rs779,980</strong>
                  <span>Calculated ledger</span>
                </div>
              </div>
              <div className="preview-body">
                <div className="preview-chart">
                  <span>Monthly cash flow</span>
                  <svg viewBox="0 0 320 110" role="img" aria-label="Rising cash-flow line">
                    <defs>
                      <linearGradient id="previewFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#5eead4" stopOpacity=".4" />
                        <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,90 C45,80 55,45 100,58 S165,80 205,38 S270,32 320,15 L320,110 L0,110Z" fill="url(#previewFill)" />
                    <path d="M0,90 C45,80 55,45 100,58 S165,80 205,38 S270,32 320,15" fill="none" stroke="#14b8a6" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="preview-bills">
                  <span>Bills waiting</span>
                  {[
                    ["Rent", "Rs38,000"],
                    ["Internet", "Rs5,200"],
                    ["Utilities", "Paid"],
                  ].map(([name, value]) => (
                    <div key={name}>
                      <i />
                      <b>{name}</b>
                      <small>{value}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="floating-card savings-float">
              <PiggyBank size={20} />
              <div><small>Savings protected</small><strong>Rs150,000</strong></div>
            </div>
            <div className="floating-card privacy-float">
              <LockKeyhole size={19} />
              <div><small>Personal expenses</small><strong>Private</strong></div>
            </div>
          </div>
        </section>

        <section className="feature-section">
          <div className="section-heading">
            <span>A calmer monthly routine</span>
            <h2>One place for the plan and the truth</h2>
            <p>Expected bills and actual bank movements stay separate, so your numbers remain useful all month.</p>
          </div>
          <div className="feature-grid">
            {[
              [WalletCards, "Monthly workspace", "Copy recurring income and bills into a fresh month, then record payments as they happen."],
              [PiggyBank, "Savings envelopes", "Reserve money for named goals without pretending it left your bank account."],
              [ReceiptText, "Private spending", "Members keep item details private while anonymous totals keep the shared bank accurate."],
              [BarChart3, "Useful reports", "See income, spending, cash flow, savings growth, and reconciliation trends."],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof WalletCards;
              return (
                <article key={title as string}>
                  <span><FeatureIcon size={21} /></span>
                  <h3>{title as string}</h3>
                  <p>{copy as string}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span>Finance Manager · PKR household planning</span>
        <span>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
          <a href="/data-deletion">Data deletion</a>
        </span>
      </footer>
    </div>
  );
}
