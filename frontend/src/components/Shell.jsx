import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Award, BookOpen, CalendarCheck, ClipboardList, FileText, Flag, Languages, LayoutDashboard, LogOut, Map, Moon, Settings, Shield, Sun, Trophy, User, Users } from "lucide-react";
import { useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Seal } from "./Brand";
import { InstallApp } from "./InstallApp";

/**
 * The navigation is where the role boundary of Table 1.1 becomes visible.
 *
 * The System Administrator's menu holds circles, circle supervisors, the activity log and
 * the system settings — the deployment, and the supervisors they hand each circle to.
 * Teachers, students and everything measured about them appear only under the Circle
 * Supervisor and the Teacher, because that is where the responsibility for them sits.
 */
const NAV = {
  SYS_ADMIN: [
    ["/admin", "nav_circles", Users],
    ["/admin/circle-admins", "nav_circle_admins", Shield],
    ["/admin/audit", "nav_audit", ClipboardList],
    ["/admin/settings", "nav_settings", Settings],
    ["/admin/account", "nav_account", User],
  ],
  CIRCLE_ADMIN: [
    ["/circle", "nav_overview", LayoutDashboard],
    ["/circle/roster", "nav_roster", Users],
    ["/circle/report", "nav_report", FileText],
    ["/circle/leaderboard", "nav_leaderboard", Trophy],
    ["/circle/account", "nav_account", User],
  ],
  TEACHER: [
    ["/teacher", "nav_overview", LayoutDashboard],
    ["/teacher/students", "nav_students", Users],
    ["/teacher/attendance", "nav_attendance", CalendarCheck],
    ["/teacher/log", "nav_log_session", BookOpen],
    ["/teacher/account", "nav_account", User],
  ],
  STUDENT: [
    ["/student", "nav_dashboard", LayoutDashboard],
    ["/student/journey", "nav_journey", Map],
    ["/student/leaderboard", "nav_leaderboard", Trophy],
    ["/student/badges", "nav_badges", Award],
    ["/student/challenges", "nav_challenges", Flag],
  ],
};

const toolBtn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-card text-[13px] font-medium text-foreground transition-colors hover:bg-muted";

export function LangThemeToggles() {
  const { t, toggle } = useT();
  const [dark, setDark] = useState(() => localStorage.getItem("halaqtna_theme") === "dark");
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("halaqtna_theme", dark ? "dark" : "light"); }, [dark]);
  return (
    <div className="flex items-center gap-1.5">
      <button data-testid="language-toggle-button" onClick={toggle} className={`${toolBtn} px-2.5`}><Languages size={14} strokeWidth={1.75} />{t("language")}</button>
      <button data-testid="theme-toggle-button" onClick={() => setDark(!dark)} aria-label={t("theme")} aria-pressed={dark} className={`${toolBtn} w-9`}>
        {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
      </button>
    </div>
  );
}

export function Shell({ children }) {
  const { t } = useT();
  const { actor, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[actor.role] || [];
  return (
    <div className="min-h-screen md:flex" data-testid="app-shell">
      {/* One element: a top bar on a phone, the ruled sidebar of a register from md up. */}
      <aside className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-sidebar px-4 py-2.5 md:h-screen md:w-[260px] md:shrink-0 md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-e md:p-0">
        <div className="flex min-w-0 items-center gap-3 md:border-b md:border-border md:px-5 md:pb-5 md:pt-6">
          <Seal className="h-8 w-8 md:h-10 md:w-10" />
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold leading-tight md:text-[22px]">{t("app_name")}</div>
            <div className="truncate text-[11px] text-muted-foreground md:text-xs" data-testid="shell-role-label">{t(`role_${actor.role}`)}</div>
          </div>
        </div>

        <nav className="hidden md:flex md:flex-1 md:flex-col md:gap-0.5 md:overflow-y-auto md:px-3 md:py-4">
          {items.map(([to, key, Icon]) => (
            <NavLink key={to} to={to} end data-testid={`nav-${key}`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon size={17} strokeWidth={1.75} className="shrink-0" />{t(key)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 md:flex-col md:items-stretch md:gap-3 md:border-t md:border-border md:p-4">
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm font-semibold" data-testid="shell-actor-name">{actor.name}</div>
            {actor.circle?.name && <div className="truncate text-xs text-muted-foreground">{actor.circle.name}</div>}
          </div>
          <div className="flex items-center gap-1.5">
            <InstallApp compact />
            <LangThemeToggles />
          </div>
          <button data-testid="logout-button" onClick={() => { logout(); nav("/login"); }} aria-label={t("logout")}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/[0.07] hover:text-destructive md:justify-start">
            <LogOut size={15} strokeWidth={1.75} className="rtl:-scale-x-100" /><span className="hidden md:inline">{t("logout")}</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-14 md:pt-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map(([to, key, Icon]) => (
          <NavLink key={to} to={to} end data-testid={`mnav-${key}`}
            className={({ isActive }) => `relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-center text-[10px] leading-tight transition-colors ${isActive ? "font-semibold text-primary before:absolute before:inset-x-4 before:top-0 before:h-[2px] before:rounded-b-full before:bg-primary" : "text-muted-foreground"}`}>
            <Icon size={19} strokeWidth={1.75} className="shrink-0" /><span className="max-w-[4.75rem] truncate">{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
