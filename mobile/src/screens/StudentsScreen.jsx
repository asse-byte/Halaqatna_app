import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { api, errMsg, setToken } from "../api";
import { useT } from "../i18n";

export default function StudentsScreen({ navigation, onLogout }) {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const load = () => api.get("/students").then((r) => setRows(r.data)).catch((e) => Alert.alert(t("error"), errMsg(e)));
  useFocusEffect(useCallback(() => { load(); }, []));
  const regen = (st) => api.post(`/students/${st.student_id}/access-code`).then(load).catch((e) => Alert.alert(t("error"), errMsg(e)));
  const logout = async () => { await SecureStore.deleteItemAsync("token"); setToken(null); onLogout(); };
  return (
    <View style={s.wrap}>
      <View style={s.head}><Text style={s.title}>{t("my_students")}</Text><Pressable onPress={logout}><Text style={s.link}>{t("logout")}</Text></Pressable></View>
      <FlatList data={rows} keyExtractor={(x) => String(x.student_id)} renderItem={({ item }) => (
        <View style={s.card} testID={`student-card-${item.student_id}`}>
          <Text style={s.name}>{item.name}</Text>
          <Text style={s.meta}>{t("juz")} {item.current_juz}</Text>
          <View style={s.codeRow}><Text style={s.meta}>{t("access_code")}</Text><Text style={s.code}>{item.access_code}</Text><Pressable onPress={() => regen(item)}><Text style={s.link}>{t("regenerate_code")}</Text></Pressable></View>
          <View style={s.row}>
            <Pressable style={[s.btn, s.ghost]} onPress={() => navigation.navigate("Performance", { id: item.student_id, name: item.name })}><Text>{t("view_performance")}</Text></Pressable>
            <Pressable style={s.btn} onPress={() => navigation.navigate("LogSession", { studentId: item.student_id })}><Text style={s.btnTxt}>{t("log_session")}</Text></Pressable>
          </View>
        </View>
      )} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#FDFBF7" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#0F382C" },
  link: { color: "#134E4A", fontWeight: "600", fontSize: 12 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  name: { fontSize: 16, fontWeight: "700" },
  meta: { color: "#475569", fontSize: 12 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F1F5F9", borderRadius: 10, padding: 8, marginTop: 8 },
  code: { fontFamily: "monospace", letterSpacing: 4, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: { flex: 1, backgroundColor: "#0F382C", borderRadius: 10, padding: 12, alignItems: "center", minHeight: 44 },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  btnTxt: { color: "#fff", fontWeight: "700" },
});
