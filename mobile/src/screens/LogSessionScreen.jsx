import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, errMsg } from "../api";
import { useT } from "../i18n";
import { queueSession } from "../offline";

const ATT = ["P", "L", "E", "A"];
const TYPES = ["NEW", "REVIEW", "MIXED"];
const COLORS = { MEM_GAP: "#FEE2E2", LNK_ERR: "#FEF3C7", TAJ_ERR: "#DBEAFE", SLF_CRT: "#D1FAE5" };

export default function LogSessionScreen({ route, navigation }) {
  const { t, locale } = useT();
  const [types, setTypes] = useState([]);
  const [f, setF] = useState({ student_id: route.params.studentId, session_date: new Date().toISOString().slice(0, 10), attendance_status: "P", session_type: "NEW", surah_from: "1", ayah_from: "1", surah_to: "1", ayah_to: "7", pages_memorized: "1", errors: [] });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { api.get("/error-types").then((r) => setTypes(r.data)); }, []);
  const load = useMemo(() => f.errors.reduce((a, e) => a + Number(types.find((x) => x.error_type_id === e.error_type_id)?.weight || 0), 0), [f.errors, types]);

  const submit = async () => {
    const body = { ...f, surah_from: +f.surah_from, ayah_from: +f.ayah_from, surah_to: +f.surah_to, ayah_to: +f.ayah_to, pages_memorized: +f.pages_memorized, client_uuid: `${Date.now()}-${Math.random()}` };
    try { await api.post("/sessions", body); Alert.alert(t("saved"), t("session_saved")); navigation.goBack(); }
    catch (e) {
      if (!e.response) { await queueSession(body); Alert.alert(t("saved"), t("queued_offline")); navigation.goBack(); }
      else Alert.alert(t("error"), errMsg(e));
    }
  };

  const Seg = ({ options, value, onChange, label }) => (
    <View style={s.seg}>{options.map((o) => <Pressable key={o} testID={`${label}-${o}`} onPress={() => onChange(o)} style={[s.segBtn, value === o && s.segOn]}><Text style={[s.segTxt, value === o && s.segTxtOn]}>{t(`${label}_${o}`)}</Text></Pressable>)}</View>
  );

  return (
    <ScrollView contentContainerStyle={s.wrap} style={{ backgroundColor: "#FDFBF7" }}>
      <Text style={s.title}>{t("log_session_title")}</Text>
      <Text style={s.label}>{t("session_date")}</Text><TextInput style={s.input} value={f.session_date} onChangeText={(v) => set("session_date", v)} />
      <Text style={s.label}>{t("attendance")}</Text><Seg options={ATT} value={f.attendance_status} onChange={(v) => set("attendance_status", v)} label="att" />
      <Text style={s.label}>{t("session_type")}</Text><Seg options={TYPES} value={f.session_type} onChange={(v) => set("session_type", v)} label="type" />
      <Text style={s.label}>{t("range")}</Text>
      <View style={s.grid}>{["surah_from", "ayah_from", "surah_to", "ayah_to"].map((k) => <View key={k} style={s.half}><Text style={s.small}>{t(k)}</Text><TextInput style={s.input} keyboardType="numeric" value={f[k]} onChangeText={(v) => set(k, v)} /></View>)}</View>
      <Text style={s.label}>{t("pages_memorized")}</Text><TextInput style={s.input} keyboardType="decimal-pad" value={f.pages_memorized} onChangeText={(v) => set("pages_memorized", v)} />
      <View style={s.panel}>
        <Text style={s.label}>{t("errors")} · E(s)={load.toFixed(2)}</Text>
        <View style={s.grid}>{types.map((ty) => <Pressable key={ty.code} testID={`error-tag-${ty.code}`} style={[s.tag, { backgroundColor: COLORS[ty.code] }]} onPress={() => set("errors", [...f.errors, { error_type_id: ty.error_type_id, ayah_ref: `${f.surah_from}:${f.ayah_from}` }])}><Text style={s.tagTxt}>{locale === "ar" ? ty.label_ar : ty.label_en} · {Number(ty.weight).toFixed(2)}</Text></Pressable>)}</View>
        <View style={s.chips}>{f.errors.length === 0 ? <Text style={s.small}>{t("no_errors")}</Text> : f.errors.map((e, i) => { const ty = types.find((x) => x.error_type_id === e.error_type_id); return <Pressable key={i} onPress={() => set("errors", f.errors.filter((_, j) => j !== i))} style={[s.chip, { backgroundColor: COLORS[ty?.code] }]}><Text style={s.small}>{locale === "ar" ? ty?.label_ar : ty?.label_en} {e.ayah_ref} ×</Text></Pressable>; })}</View>
      </View>
      <Pressable testID="session-log-submit-button" style={s.btn} onPress={submit}><Text style={s.btnTxt}>{t("save_session")}</Text></Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#0F382C", marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 12, marginBottom: 4 },
  small: { fontSize: 11, color: "#475569" },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, backgroundColor: "#fff" },
  seg: { flexDirection: "row", gap: 6 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  segOn: { backgroundColor: "#0F382C", borderColor: "#0F382C" },
  segTxt: { fontSize: 12 }, segTxtOn: { color: "#fff", fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  half: { width: "48%" },
  panel: { backgroundColor: "#fff", borderRadius: 14, padding: 10, marginTop: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  tag: { width: "48%", minHeight: 44, borderRadius: 22, justifyContent: "center", paddingHorizontal: 12 },
  tagTxt: { fontSize: 12, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  btn: { backgroundColor: "#0F382C", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20, minHeight: 44 },
  btnTxt: { color: "#fff", fontWeight: "700" },
});
