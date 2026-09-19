import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, errMsg } from "../api";
import { useT } from "../i18n";

export default function PerformanceScreen({ route }) {
  const { t } = useT();
  const { id, name } = route.params;
  const [m, setM] = useState(null);
  const [pred, setPred] = useState(null);
  useEffect(() => {
    api.get(`/students/${id}/metrics`).then((r) => setM(r.data)).catch((e) => Alert.alert(t("error"), errMsg(e)));
    api.get(`/students/${id}/prediction`).then((r) => setPred(r.data));
  }, [id]);
  if (!m) return <Text style={{ padding: 16 }}>{t("loading")}</Text>;
  const cards = [["mastery", m.mastery], ["momentum", m.momentum], ["precision", m.precision], ["consistency", m.consistency], ["review_depth", m.review_depth], ["xp", m.xp_total]];
  return (
    <ScrollView contentContainerStyle={s.wrap} style={{ backgroundColor: "#FDFBF7" }}>
      <Text style={s.title}>{name}</Text>
      <View style={s.grid}>{cards.map(([k, v]) => <View key={k} style={s.card} testID={`${k}-card`}><Text style={s.label}>{t(k)}</Text><Text style={s.value}>{v ?? "—"}</Text></View>)}</View>
      <View style={s.card}>
        <Text style={s.label}>{t("forecast")}</Text>
        {pred?.prediction ? <>
          <Text style={s.value}>{pred.prediction.predicted_completion_date}</Text>
          <Text style={s.small}>{t("forecast_eta", { days: pred.prediction.eta_days })} · {pred.prediction.model_version}</Text>
          {pred.stale && <Text style={s.warn}>{t("forecast_stale")} — {String(pred.prediction.generated_at).slice(0, 16)}</Text>}
        </> : <Text style={s.small}>{t("forecast_none")}</Text>}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#0F382C", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  label: { fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1 },
  value: { fontSize: 24, fontWeight: "700", color: "#0F382C", fontFamily: "monospace" },
  small: { fontSize: 11, color: "#475569" },
  warn: { fontSize: 11, color: "#B45309", marginTop: 6 },
});
