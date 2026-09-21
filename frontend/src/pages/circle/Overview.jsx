import { CircleDashboard } from "../../components/CircleDashboard";
import { useT } from "../../lib/i18n";

/** The Circle Supervisor's dashboard: every student in the circle, and what needs doing. */
export default function CircleOverview() {
  const { t } = useT();
  return <CircleDashboard title={t("overview_title")} />;
}
