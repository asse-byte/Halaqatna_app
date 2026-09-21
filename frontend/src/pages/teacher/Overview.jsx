import { CircleDashboard } from "../../components/CircleDashboard";
import { useT } from "../../lib/i18n";

/**
 * The teacher's dashboard. The same component as the Supervisor's, but the API returns only
 * the students assigned to this teacher (FR16), so a teacher never sees a colleague's
 * students here — or anywhere else.
 */
export default function TeacherOverview() {
  const { t } = useT();
  return <CircleDashboard title={t("my_circle_title")} />;
}
