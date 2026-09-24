import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, errMsg } from "../api";
import { useT } from "../i18n";
import { bandFor } from "../mastery";
const TREND_TONE = { UP: "#0f7b6c", DOWN: "#9a4b2f", STEADY: "#475569", NEW: "#94A3B8" };

/**
 * What the teacher sees when they open a student on the phone.
 *
 * Each figure carries the phrase that says what it counts and a line of explanation, the
 * same wording the web client and the printed report use. The model version and the
 * generation timestamp of the forecast were dropped: they are diagnostics for the
 * prediction service, not something a teacher needs mid-circle.
 */
export default function PerformanceScreen({ route }) {
  const { t } = useT();
  const { id, name } = route.params;
  const [m, setM] = useState(null);
  const [pred, setPred] = useState(null);

  useEffect(() => {
    api.get(`/students/${id}/metrics`).then((r) => setM(r.data)).catch((e) => Alert.alert(t("error"), errMsg(e)));
    api.get(`/students/${id}/prediction`).then((r) => setPred(r.data)).catch(() => {});
  }, [id]);

  if (!m) return <Text style={{ padding: 16 }}>{t("loading")}</Text>;

  const cards = [
    ["momentum", m.momentum, t("pages_per_week")],
    ["precision", m.precision, "%"],
    ["consistency", m.consistency, "%"],
    ["review_depth", m.review_depth, t("review_pages_unit")],
    ["total_pages", m.total_pages, ""],
    ["attendance_rate", Math.round((m.attendance_rate ?? 0) * 100), "%"],
  ];
  const dir = m.trend_summary?.direction || "NEW";

  return (
    <ScrollView contentContainerStyle={s.wrap} style={{ backgroundColor: "#FDFBF7" }}>
      <Text style={s.title}>{name}</Text>

      <View style={s.hero} testID="mastery-score-card">
        <Text style={s.label}>{t("mastery")}</Text>
        <Text style={s.hval}>{m.mastery ?? "—"}<Text style={s.small}> / 100</Text></Text>
        <Text style={s.band}>{t(`band_${bandFor(m.mastery)}`)}</Text>
        <Text style={s.hint}>{t("mastery_hint")}</Text>
        <Text style={[s.trend, { color: TREND_TONE[dir] }]} testID="trend-direction">{t("trend")}: {t(`trend_${dir}`)}</Text>
      </View>

      <View style={s.grid}>{cards.map(([k, v, unit]) => (
        <View key={k} style={s.card} testID={`${k}-card`}>
          <Text style={s.label}>{t(k)}</Text>
          <Text style={s.value}>{v ?? "—"}<Text style={s.small}> {unit}</Text></Text>
          {t(`${k}_hint`) !== `${k}_hint` && <Text style={s.hint}>{t(`${k}_hint`)}</Text>}
        </View>
      ))}</View>

      <View style={s.wide}>
        <Text style={s.label}>{t("forecast")}</Text>
        {pred?.prediction?.predicted_completion_date ? (
          <>
            <Text style={s.value}>{pred.prediction.predicted_completion_date}</Text>
            <Text style={s.small}>{t("forecast_eta", { days: pred.prediction.eta_days })}</Text>
            {pred.stale && <Text style={s.warn}>{t("forecast_stale")}</Text>}
          </>
        ) : <Text style={s.small}>{t("forecast_none")}</Text>}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "800", color: "#0F382C", marginBottom: 12 },
  hero: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10 },
  hval: { fontSize: 40, fontWeight: "800", color: "#0F382C" },
  band: { fontSize: 15, fontWeight: "700", color: "#0f7b6c", marginTop: 2 },
  trend: { fontSize: 12, fontWeight: "700", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  wide: { backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", marginTop: 4 },
  label: { fontSize: 11, color: "#475569", fontWeight: "600" },
  value: { fontSize: 24, fontWeight: "700", color: "#0F382C" },
  small: { fontSize: 11, color: "#475569" },
  hint: { fontSize: 10, color: "#7b8580", marginTop: 4, lineHeight: 14 },
  warn: { fontSize: 11, color: "#B45309", marginTop: 6 },
});
