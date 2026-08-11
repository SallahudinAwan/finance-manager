import {
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Languages,
  LockKeyhole,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { motion, MotionConfig, type Variants } from "motion/react";
import { RavaniLogo, RavaniMark } from "../components/RavaniMark";

const reveal: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};

export function LandingPage() {
  const next = encodeURIComponent(window.location.pathname);
  return (
    <MotionConfig reducedMotion="user">
    <div className="landing">
      <motion.header
        className="landing-nav"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <a className="landing-brand" href="/">
          <RavaniLogo />
        </a>
        <motion.a
          className="button secondary"
          href={`/accounts/google/login/?process=login&next=${next}`}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          Sign in
        </motion.a>
      </motion.header>
      <main>
        <section className="hero">
          <motion.div
            className="hero-copy"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <motion.span className="hero-badge" variants={reveal}>
              <Sparkles size={15} /> Har maah, har rupay ka hisaab
            </motion.span>
            <motion.h1 variants={reveal}>
              Give every rupee a path.
              <em> Own the whole month.</em>
            </motion.h1>
            <motion.p variants={reveal}>
              From salary day to month-end, plan household bills, protect savings,
              manage personal spending, and know exactly what remains.
            </motion.p>
            <motion.div className="hero-actions" variants={reveal}>
              <motion.a
                className="button primary large"
                href={`/accounts/google/login/?process=login&next=${next}`}
                whileHover={{ y: -3, scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
              >
                Continue with Google <ArrowRight size={18} />
              </motion.a>
              <span>
                <ShieldCheck size={16} /> Free to start · PKR
              </span>
            </motion.div>
            <motion.div className="hero-points" variants={reveal}>
              <span><Check size={15} /> No bank connection required</span>
              <span><Check size={15} /> Private member expenses</span>
              <span><Check size={15} /> Export your data anytime</span>
            </motion.div>
          </motion.div>
          <motion.div
            className="hero-visual"
            aria-label="Ravani monthly money dashboard preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.75, delay: 0.2 }}
          >
            <motion.div
              className="preview-window"
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <div className="preview-top">
                <span className="preview-logo"><RavaniMark size={14} /></span>
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
                    <motion.path
                      d="M0,90 C45,80 55,45 100,58 S165,80 205,38 S270,32 320,15"
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.2, delay: 0.55, ease: "easeOut" }}
                    />
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
            </motion.div>
            <div className="floating-card savings-float">
              <PiggyBank size={20} />
              <div><small>Savings protected</small><strong>Rs150,000</strong></div>
            </div>
            <div className="floating-card privacy-float">
              <LockKeyhole size={19} />
              <div><small>Personal expenses</small><strong>Private</strong></div>
            </div>
          </motion.div>
        </section>

        <motion.section
          className="landing-snapshot"
          aria-labelledby="sample-month-title"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.18 }}
          variants={reveal}
        >
          <div className="snapshot-shell">
            <div className="snapshot-heading">
              <div>
                <span className="snapshot-label"><Sparkles size={14} /> Sample data</span>
                <h2 id="sample-month-title">See what a well-planned month can look like.</h2>
                <p>
                  One salary, every obligation, protected savings, and a clear amount left
                  to enjoy—without connecting your bank account.
                </p>
              </div>
              <motion.a
                className="button snapshot-cta"
                href={`/accounts/google/login/?process=login&next=${next}`}
                whileHover={{ y: -3, scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
              >
                Try it with your numbers <ArrowRight size={17} />
              </motion.a>
            </div>

            <motion.div
              className="snapshot-metrics"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.35 }}
            >
              {[
                ["Monthly income", "Rs500,000", "Salary received", "income"],
                ["Household plan", "Rs74,200", "3 of 5 bills settled", "bills"],
                ["Savings protected", "Rs150,000", "Fixed target allocated", "savings"],
                ["Safe to spend", "Rs275,800", "Your clear personal budget", "safe"],
              ].map(([label, value, note, tone]) => (
                <motion.article
                  className={`snapshot-metric ${tone}`}
                  key={label}
                  variants={reveal}
                  whileHover={{ y: -5 }}
                >
                  <small>{label}</small>
                  <strong>{value}</strong>
                  <span><Check size={13} /> {note}</span>
                </motion.article>
              ))}
            </motion.div>

            <div className="snapshot-proof">
              <div className="sample-household">
                <div className="sample-avatars" aria-hidden="true">
                  {["SA", "FA", "AA", "MA"].map((initials) => (
                    <span key={initials}>{initials}</span>
                  ))}
                </div>
                <div>
                  <strong><UsersRound size={15} /> 4-user demo household</strong>
                  <small>Shared finances, private personal spending</small>
                </div>
              </div>
              <div className="snapshot-benefits">
                <span><Clock3 size={15} /> About 5 minutes to set up</span>
                <span><ShieldCheck size={15} /> Secure Google sign-in</span>
                <span><Languages size={15} /> English and Urdu</span>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="feature-section"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.16 }}
          variants={reveal}
        >
          <motion.div className="section-heading" variants={reveal}>
            <span>A calmer monthly routine</span>
            <h2>From salary day to month-end</h2>
            <p>Expected bills and actual bank movements stay separate, so your numbers remain useful all month.</p>
          </motion.div>
          <motion.div className="feature-grid" variants={stagger}>
            {[
              [WalletCards, "Monthly workspace", "Copy recurring income and bills into a fresh month, then record payments as they happen."],
              [PiggyBank, "Savings envelopes", "Reserve money for named goals without pretending it left your bank account."],
              [ReceiptText, "Private spending", "Members keep item details private while anonymous totals keep the shared bank accurate."],
              [BarChart3, "Useful reports", "See income, spending, cash flow, savings growth, and reconciliation trends."],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof WalletCards;
              return (
                <motion.article
                  key={title as string}
                  variants={reveal}
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                >
                  <span><FeatureIcon size={21} /></span>
                  <h3>{title as string}</h3>
                  <p>{copy as string}</p>
                </motion.article>
              );
            })}
          </motion.div>
        </motion.section>
      </main>
      <footer className="landing-footer">
        <span>Ravani · Monthly Money Manager</span>
        <span>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
          <a href="/data-deletion">Data deletion</a>
        </span>
      </footer>
    </div>
    </MotionConfig>
  );
}
