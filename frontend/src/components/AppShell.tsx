import {
  Bell,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  CircleHelp,
  Settings,
  Sun,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { Session } from "../types";
import { GuidedTour } from "./GuidedTour";
import { LanguageSwitcher } from "./LanguageSwitcher";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/month", label: "This month", icon: WalletCards },
  { to: "/app/savings", label: "Savings", icon: PiggyBank },
  { to: "/app/reports", label: "Reports", icon: ChartNoAxesCombined },
  { to: "/app/notifications", label: "Notifications", icon: Bell },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/account", label: "Account", icon: UserRound },
];

export function AppShell({ session }: { session: Session }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [tourOpen, setTourOpen] = useState(!session.user.tour_completed);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand" data-tour="brand">
          <span className="brand-mark">
            <Landmark size={20} />
          </span>
          <span className="brand-copy">
            <strong>Finance Manager</strong>
            <small>{session.household?.name}</small>
          </span>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list" aria-label="Primary navigation">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
              data-tour={
                item.to === "/app"
                  ? "overview"
                  : item.to === "/app/month"
                    ? "month"
                    : item.to === "/app/savings"
                      ? "savings"
                      : item.to === "/app/reports"
                        ? "reports"
                        : undefined
              }
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <span>{session.user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{session.user.name}</strong>
              <small>{session.is_owner ? "Household owner" : "Household member"}</small>
            </div>
          </div>
          <a className="logout-link" href="/accounts/logout/">
            <LogOut size={18} />
            <span>Sign out</span>
          </a>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main>
        <div className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>
          <button
            className="collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <div className="topbar-spacer" />
          <button
            className="theme-button"
            type="button"
            aria-label="Start guided tour"
            title="Start guided tour"
            onClick={() => setTourOpen(true)}
          >
            <CircleHelp size={18} />
          </button>
          <span data-tour="language">
            <LanguageSwitcher />
          </span>
          <span className="currency-pill">PKR · Karachi</span>
          <button
            className="theme-button"
            onClick={() => setDark((value) => !value)}
            aria-label="Toggle color theme"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div className="page-container">
          <Outlet context={{ session }} />
        </div>
      </main>
      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
