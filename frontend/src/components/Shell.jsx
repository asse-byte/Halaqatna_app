import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Award, BookOpen, ClipboardList, FileText, Flag, Globe, LayoutDashboard, LogOut, Map, Moon, Settings, Shield, Sun, Trophy, Users } from "lucide-react";
import { useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";

const NAV = {
  SYS_ADMIN: [["/admin", "nav_circles", Users], ["/admin/circle-admins", "nav_circle_admins", Shield], ["/admin/audit", "nav_audit", ClipboardList], ["/admin/settings", "nav_settings", Settings]],
  CIRCLE_ADMIN: [["/circle", "nav_roster", Users], ["/circle/report", "nav_report", FileText], ["/circle/leaderboard", "nav_leaderboard", Trophy]],
  TEACHER: [["/teacher", "nav_students", Users], ["/teacher/log", "nav_log_session", BookOpen], ["/teacher/leaderboard", "nav_leaderboard", Trophy]],
  STUDENT: [["/student", "nav_dashboard", LayoutDashboard], ["/student/journey", "nav_journey", Map], ["/student/leaderboard", "nav_leaderboard", Trophy], ["/student/badges", "nav_badges", Award], ["/student/challenges", "nav_challenges", Flag]],
};

export function LangThemeToggles() {
  const { t, toggle } = useT();
  const [dark, setDark] = useState(() => localStorage.getItem("halaqtna_theme") === "dark");
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("halaqtna_theme", dark ? "dark" : "light"); }, [dark]);
  return (
    <div className="flex items-center gap-1">
      <button data-testid="language-toggle-button" onClick={toggle} className="chip border-border hover:bg-primary/10 !min-h-9"><Globe size={14} />{t("language")}</button>
      <button data-testid="theme-toggle-button" onClick={() => setDark(!dark)} aria-label={t("theme")} className="grid h-9 w-9 place-items-center rounded-full border hover:bg-primary/10">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
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
      <aside className="glass sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 md:h-screen md:w-64 md:flex-col md:items-stretch md:justify-start md:py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-quran text-lg">ح</div>
          <div><div className="font-bold leading-tight">{t("app_name")}</div><div className="text-[11px] text-muted-foreground" data-testid="shell-role-label">{t(`role_${actor.role}`)}</div></div>
        </div>
        <nav className="hidden md:mt-8 md:flex md:flex-1 md:flex-col md:gap-1">
          {items.map(([to, key, Icon]) => <NavLink key={to} to={to} end data-testid={`nav-${key}`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon size={16} />{t(key)}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2 md:flex-col md:items-stretch">
          <div className="hidden text-xs text-muted-foreground md:block truncate" data-testid="shell-actor-name">{actor.name}</div>
          <LangThemeToggles />
          <button data-testid="logout-button" onClick={() => { logout(); nav("/login"); }} className="chip border-border hover:bg-destructive/10 hover:text-destructive !min-h-9"><LogOut size={14} /><span className="hidden sm:inline">{t("logout")}</span></button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden px-4 pb-24 pt-5 md:px-10 md:pb-10 md:pt-8">{children}</main>
      <nav className="glass fixed inset-x-0 bottom-0 z-20 flex justify-around py-1.5 md:hidden">
        {items.map(([to, key, Icon]) => <NavLink key={to} to={to} end data-testid={`mnav-${key}`} className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] ${isActive ? "text-primary font-bold" : "text-muted-foreground"}`}><Icon size={18} />{t(key)}</NavLink>)}
      </nav>
    </div>
  );
}
