import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, errMsg } from "../api";
import { useT } from "../i18n";
import { localToday } from "../dates";

/**
 * Taking the register on the phone (FR4).
 *
 * This is the screen a teacher opens first, before anyone recites: pick the day, tap a
 * status per student, save once. It is deliberately separate from the recitation form,
 * which used to be the only way to record that someone was absent.
 *
 * Three statuses. "Late" was dropped because every teacher treated a late arrival as
 * present, and nothing in the system ever told the two apart.
 */
const STATUSES = ["P", "A", "E"];
const TONE = { P: "#D1FAE5", A: "#FEE2E2", E: "#E2E8F0" };

export default function AttendanceScreen() {
  const { t } = useT();
  const [date, setDate] = useState(localToday());
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    api.get("/attendance", { params: { session_date: date } })
      .then((r) => setRows(r.data.rows))
      .catch((e) => Alert.alert(t("error"), errMsg(e)));
  }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (id, status) => setRows((xs) => xs.map((x) => (x.student_id === id ? { ...x, attendance_status: status } : x)));

  const save = async () => {
    const entries = (rows || []).filter((r) => r.attendance_status).map((r) => ({ student_id: r.student_id, attendance_status: r.attendance_status }));
    if (!entries.length) return;
    setBusy(true);
    try { await api.post("/attendance", { session_date: date, entries }); Alert.alert(t("saved"), t("attendance_saved")); load(); }
    catch (e) { Alert.alert(t("error"), errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} style={{ backgroundColor: "#FDFBF7" }}>
      <Text style={s.title}>{t("attendance_title")}</Text>
      <Text style={s.small}>{t("attendance_subtitle")}</Text>

      <Text style={s.label}>{t("session_date")}</Text>
      <TextInput testID="attendance-date" style={s.input} value={date} onChangeText={setDate} />

      <Pressable testID="mark-all-present" style={[s.btn, s.ghost]} onPress={() => setRows((xs) => (xs || []).map((x) => ({ ...x, attendance_status: x.attendance_status ?? "P" })))}>
        <Text>{t("mark_all_present")}</Text>
      </Pressable>

      {rows === null && <Text style={s.small}>{t("loading")}</Text>}
      {rows?.length === 0 && <Text style={s.small}>{t("no_students_yet")}</Text>}

      {rows?.map((r) => (
        <View key={r.student_id} testID={`attendance-row-${r.student_id}`} style={s.card}>
          <Text style={s.name}>{r.name}</Text>
          <Text style={s.small}>{r.attendance_status ? t(`att_${r.attendance_status}`) : t("att_none")}</Text>
          <View style={s.seg}>{STATUSES.map((st) => (
            <Pressable key={st} testID={`att-${r.student_id}-${st}`} onPress={() => set(r.student_id, st)}
              style={[s.segBtn, { backgroundColor: TONE[st] }, r.attendance_status === st && s.segOn]}>
              <Text style={s.segTxt}>{t(`att_${st}`)}</Text>
            </Pressable>
          ))}</View>
        </View>
      ))}

      {rows?.length > 0 && (
        <Pressable testID="save-attendance" style={s.btn} onPress={save} disabled={busy}>
          <Text style={s.btnTxt}>{busy ? t("saving") : t("save_attendance")}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#0F382C" },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 12, marginBottom: 4 },
  small: { fontSize: 11, color: "#475569", lineHeight: 16 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, backgroundColor: "#fff", minHeight: 44 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  name: { fontSize: 15, fontWeight: "700" },
  seg: { flexDirection: "row", gap: 6, marginTop: 8 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  segOn: { borderColor: "#0F382C", borderWidth: 2 },
  segTxt: { fontSize: 12, fontWeight: "600" },
  btn: { backgroundColor: "#0F382C", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16, minHeight: 44 },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  btnTxt: { color: "#fff", fontWeight: "700" },
});
