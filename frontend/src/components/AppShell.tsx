import {
  Bell,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
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
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { Session } from "../types";
import {
  applyTheme,
  type ColorTheme,
  getStoredTheme,
  getSystemTheme,
  saveThemePreference,
} from "../utils/theme";
import { GuidedTour } from "./GuidedTour";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { RavaniLogo } from "./RavaniMark";

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
  const [themePreference, setThemePreference] = useState<ColorTheme | null>(getStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ColorTheme>(getSystemTheme);
  const [tourOpen, setTourOpen] = useState(!session.user.tour_completed);
  const [tourNavigationOpen, setTourNavigationOpen] = useState(false);
  const location = useLocation();
  const theme = themePreference ?? systemTheme;
  const dark = theme === "dark";

  useEffect(() => {
    if (!tourOpen || !tourNavigationOpen) setMobileOpen(false);
  }, [location.pathname, tourNavigationOpen, tourOpen]);
  useEffect(() => {
    if (tourOpen) setCollapsed(false);
  }, [tourOpen]);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);
  const handleTourMobileNavigation = useCallback((open: boolean) => {
    setTourNavigationOpen(open);
    if (window.matchMedia("(max-width: 880px)").matches) setMobileOpen(open);
  }, []);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    setTourNavigationOpen(false);
    setMobileOpen(false);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand" data-tour="brand">
          <RavaniLogo />
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
                        ? "reports-nav"
                        : item.to === "/app/notifications"
                          ? "notifications-nav"
                          : item.to === "/app/settings"
                            ? "settings-nav"
                            : "account"
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
          <div className="topbar-preferences" data-tour="preferences">
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
              onClick={() => {
                const nextTheme = dark ? "light" : "dark";
                setThemePreference(nextTheme);
                saveThemePreference(nextTheme);
              }}
              aria-label="Toggle color theme"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="page-container"
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Outlet context={{ session }} />
          </motion.div>
        </AnimatePresence>
      </main>
      <GuidedTour
        open={tourOpen}
        isOwner={session.is_owner}
        onClose={closeTour}
        onMobileNavigationChange={handleTourMobileNavigation}
      />
    </div>
    </MotionConfig>
  );
}
