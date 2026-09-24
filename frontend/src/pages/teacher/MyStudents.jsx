import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, RefreshCw } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnGhost, btnPrimary, ConfirmDialog, PageTitle } from "../../components/ui-kit";

/**
 * The teacher's own students.
 *
 * There is no "add student" button here any more: enrolling a student is the Circle
 * Supervisor's act (FR20, Table 1.1). A teacher who also supervises their circle signs in
 * with that role and registers students from the roster screen.
 */
export default function MyStudents() {
  const { t } = useT();
  const [rows, setRows] = useState(null);
  const [rotating, setRotating] = useState(null);

  const load = () => api.get("/students").then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  /** A new code signs the student out everywhere, so it is never one stray tap away. */
  const rotateCode = (s) => api.post(`/students/${s.student_id}/access-code`)
    .then(() => { toast.success(t("code_regenerated")); load(); })
    .catch((e) => toast.error(errMsg(e)));

  if (!rows) return <div className="text-muted-foreground">{t("loading")}</div>;
  return (
    <div>
      <PageTitle title={t("my_students")}>
        <Link to="/teacher/log" data-testid="go-log-session-button" className={btnPrimary}><BookOpen size={16} />{t("log_session")}</Link>
      </PageTitle>

      {rows.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">{t("no_students_yet")}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s, i) => (
          <div key={s.student_id} data-testid={`student-card-${s.student_id}`} className="glass rounded-2xl p-4 animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-bold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{t("juz")} {s.current_juz}{s.circle?.name ? ` · ${s.circle.name}` : ""}</div>
              </div>
              {!s.is_active && <span className="chip !min-h-0 border-red-300 text-[11px] text-red-700 dark:text-red-400">{t("suspended")}</span>}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
              <span className="text-xs text-muted-foreground">{t("access_code")}</span>
              <span className="font-mono font-semibold tracking-widest" dir="ltr" data-testid={`access-code-${s.student_id}`}>{s.access_code}</span>
              <button data-testid={`regenerate-code-${s.student_id}`} className="text-muted-foreground transition-colors hover:text-primary" onClick={() => setRotating(s)} title={t("regenerate_code")}>
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <Link to={`/staff/students/${s.student_id}`} data-testid={`view-performance-${s.student_id}`} className={`${btnGhost} flex-1`}>{t("view_performance")}</Link>
              <Link to={`/teacher/log?student=${s.student_id}`} data-testid={`log-for-${s.student_id}`} className={`${btnPrimary} flex-1`}>{t("log_session")}</Link>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog open={!!rotating} title={t("regenerate_code")} message={`${t("confirm_rotate_code")}\n\n${rotating?.name ?? ""}`}
        confirmLabel={t("rotate_code")} onCancel={() => setRotating(null)} onConfirm={() => { rotateCode(rotating); setRotating(null); }} />
    </div>
  );
}
