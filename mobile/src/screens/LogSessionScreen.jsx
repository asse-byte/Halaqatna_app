import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, errMsg } from "../api";
import { useT } from "../i18n";
import { newClientId, queueSession } from "../offline";
import { localToday } from "../dates";
import { ayahCount, surahName, SURAH_NUMBERS } from "../surahs";

/**
 * Recording a recitation on the phone, in the circle (NFR5).
 *
 * Same three changes as the web client, for the same reason — this is the screen a teacher
 * actually uses mid-session:
 *   - the Surah is picked from a list of names, and the ayah fields are bounded by it;
 *   - the weighted load E(s) and the per-type weights are gone, since they are the Analytics
 *     Engine's working values and told the teacher nothing;
 *   - attendance is taken on its own screen, and a session is new memorization or review.
 */
const TYPES = ["NEW", "REVIEW"];
const COLORS = { MEM_GAP: "#FEE2E2", LNK_ERR: "#FEF3C7", TAJ_ERR: "#DBEAFE", SLF_CRT: "#D1FAE5" };

export default function LogSessionScreen({ route, navigation }) {
  const { t, locale } = useT();
  const [types, setTypes] = useState([]);
  const [picker, setPicker] = useState(null); // "surah_from" | "surah_to" | null
  const [sameSurah, setSameSurah] = useState(true);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    student_id: route.params.studentId, session_date: localToday(),
    attendance_status: "P", session_type: "NEW",
    surah_from: 1, ayah_from: "1", surah_to: 1, ayah_to: "7", pages_memorized: "1", errors: [],
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { api.get("/error-types").then((r) => setTypes(r.data)).catch(() => {}); }, []);

  const pickSurah = (key, n) => {
    setF((x) => {
      const next = { ...x, [key]: n };
      const cap = ayahCount(n);
      if (key === "surah_from") {
        next.ayah_from = String(Math.min(Number(x.ayah_from) || 1, cap));
        if (sameSurah) { next.surah_to = n; next.ayah_to = String(Math.min(Number(x.ayah_to) || 1, cap)); }
      } else {
        next.ayah_to = String(Math.min(Number(x.ayah_to) || 1, cap));
      }
      return next;
    });
    setPicker(null);
  };

  const submit = async () => {
    if (busy) return;   // a second tap while the first save is in flight would record it twice
    setBusy(true);
    const body = {
      ...f,
      surah_to: sameSurah ? f.surah_from : f.surah_to,
      ayah_from: +f.ayah_from, ayah_to: +f.ayah_to, pages_memorized: +f.pages_memorized,
      client_uuid: newClientId(),
    };
    try { await api.post("/sessions", body); Alert.alert(t("saved"), t("session_saved")); navigation.goBack(); }
    catch (e) {
      if (!e.response) { await queueSession(body); Alert.alert(t("saved"), t("queued_offline")); navigation.goBack(); }
      else Alert.alert(t("error"), errMsg(e));
    } finally { setBusy(false); }
  };

  const Seg = ({ options, value, onChange, label }) => (
    <View style={s.seg}>{options.map((o) => (
      <Pressable key={o} testID={`${label}-${o}`} onPress={() => onChange(o)} style={[s.segBtn, value === o && s.segOn]}>
        <Text style={[s.segTxt, value === o && s.segTxtOn]}>{t(`${label}_${o}`)}</Text>
      </Pressable>
    ))}</View>
  );

  const toSurah = sameSurah ? f.surah_from : f.surah_to;
  return (
    <ScrollView contentContainerStyle={s.wrap} style={{ backgroundColor: "#FDFBF7" }}>
      <Text style={s.title}>{t("log_session_title")}</Text>

      <Text style={s.label}>{t("session_date")}</Text>
      <TextInput style={s.input} value={f.session_date} onChangeText={(v) => set("session_date", v)} />

      <Text style={s.label}>{t("session_type")}</Text>
      <Seg options={TYPES} value={f.session_type} onChange={(v) => set("session_type", v)} label="type" />

      <Text style={s.label}>{t("range")}</Text>
      <Pressable testID="surah-from-picker" style={s.input} onPress={() => setPicker("surah_from")}>
        <Text>{t("surah_from")}: {surahName(f.surah_from, locale)}</Text>
      </Pressable>
      <Pressable testID="same-surah-toggle" style={s.check} onPress={() => { const on = !sameSurah; setSameSurah(on); if (on) set("surah_to", f.surah_from); }}>
        <View style={[s.box, sameSurah && s.boxOn]} />
        <Text style={s.small}>{t("same_surah")}</Text>
      </Pressable>
      {!sameSurah && (
        <Pressable testID="surah-to-picker" style={s.input} onPress={() => setPicker("surah_to")}>
          <Text>{t("surah_to")}: {surahName(f.surah_to, locale)}</Text>
        </Pressable>
      )}
      <View style={s.grid}>
        <View style={s.half}>
          <Text style={s.small}>{t("ayah_from")}</Text>
          <TextInput style={s.input} keyboardType="numeric" value={f.ayah_from} onChangeText={(v) => set("ayah_from", v)} />
          <Text style={s.small}>{t("ayah_max_hint", { n: ayahCount(f.surah_from) })}</Text>
        </View>
        <View style={s.half}>
          <Text style={s.small}>{t("ayah_to")}</Text>
          <TextInput style={s.input} keyboardType="numeric" value={f.ayah_to} onChangeText={(v) => set("ayah_to", v)} />
          <Text style={s.small}>{t("ayah_max_hint", { n: ayahCount(toSurah) })}</Text>
        </View>
      </View>

      <Text style={s.label}>{t("pages_memorized")}</Text>
      <TextInput style={s.input} keyboardType="decimal-pad" value={f.pages_memorized} onChangeText={(v) => set("pages_memorized", v)} />

      <View style={s.panel}>
        <Text style={s.label}>{t("errors")} · {t("errors_count", { n: f.errors.length })}</Text>
        <Text style={s.small}>{t("tap_to_tag")}</Text>
        <View style={s.grid}>{types.map((ty) => (
          <Pressable key={ty.code} testID={`error-tag-${ty.code}`} style={[s.tag, { backgroundColor: COLORS[ty.code] }]}
            onPress={() => set("errors", [...f.errors, { error_type_id: ty.error_type_id, ayah_ref: String(f.ayah_from) }])}>
            <Text style={s.tagTxt}>{locale === "ar" ? ty.label_ar : ty.label_en}</Text>
          </Pressable>
        ))}</View>
        <View style={s.chips}>
          {f.errors.length === 0 ? <Text style={s.small}>{t("no_errors")}</Text> : f.errors.map((e, i) => {
            const ty = types.find((x) => x.error_type_id === e.error_type_id);
            return (
              <Pressable key={i} onPress={() => set("errors", f.errors.filter((_, j) => j !== i))} style={[s.chip, { backgroundColor: COLORS[ty?.code] }]}>
                <Text style={s.small}>{locale === "ar" ? ty?.label_ar : ty?.label_en} {e.ayah_ref} ×</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable testID="session-log-submit-button" style={[s.btn, busy && s.btnBusy]} onPress={submit} disabled={busy}>
        <Text style={s.btnTxt}>{busy ? t("saving") : t("save_session")}</Text>
      </Pressable>

      <Modal visible={!!picker} animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={s.modal}>
          <Text style={s.title}>{t("surah")}</Text>
          <ScrollView>
            {SURAH_NUMBERS
              .filter((n) => picker !== "surah_to" || n >= f.surah_from)
              .map((n) => (
                <Pressable key={n} testID={`surah-option-${n}`} style={s.option} onPress={() => pickSurah(picker, n)}>
                  <Text>{n}. {surahName(n, locale)}</Text>
                </Pressable>
              ))}
          </ScrollView>
          <Pressable style={[s.btn, s.ghostBtn]} onPress={() => setPicker(null)}><Text>{t("cancel")}</Text></Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#0F382C", marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 12, marginBottom: 4 },
  small: { fontSize: 11, color: "#475569" },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, backgroundColor: "#fff", minHeight: 44, justifyContent: "center" },
  check: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, minHeight: 44 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#94A3B8" },
  boxOn: { backgroundColor: "#0F382C", borderColor: "#0F382C" },
  seg: { flexDirection: "row", gap: 6 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  segTxt: { fontSize: 12 }, segTxtOn: { color: "#fff", fontWeight: "700" },
  segOn: { backgroundColor: "#0F382C", borderColor: "#0F382C" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  half: { width: "48%" },
  panel: { backgroundColor: "#fff", borderRadius: 14, padding: 10, marginTop: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  tag: { width: "48%", minHeight: 44, borderRadius: 22, justifyContent: "center", paddingHorizontal: 12 },
  tagTxt: { fontSize: 12, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  btn: { backgroundColor: "#0F382C", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20, minHeight: 44 },
  ghostBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  btnBusy: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontWeight: "700" },
  modal: { flex: 1, padding: 16, backgroundColor: "#FDFBF7" },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", minHeight: 44, justifyContent: "center" },
});
