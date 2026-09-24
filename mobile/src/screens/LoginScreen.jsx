import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, errMsg, setToken } from "../api";
import { useT } from "../i18n";

export default function LoginScreen({ onLogin }) {
  const { t, toggle } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = async () => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.user.role !== "TEACHER") return Alert.alert(t("error"), t("teacher_accounts_only"));
      await SecureStore.setItemAsync("token", data.token);
      setToken(data.token);
      onLogin();
    } catch (e) { Alert.alert(t("error"), errMsg(e)); }
  };
  return (
    <View style={s.wrap}>
      <Pressable onPress={toggle} style={s.lang}><Text style={s.langTxt}>{t("language")}</Text></Pressable>
      <Text style={s.logo}>ح</Text>
      <Text style={s.title}>{t("app_name")}</Text>
      <Text style={s.sub}>{t("staff_login")}</Text>
      <TextInput testID="login-email-input" style={s.input} placeholder={t("email")} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput testID="login-password-input" style={s.input} placeholder={t("password")} secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable testID="login-submit-button" style={s.btn} onPress={submit}><Text style={s.btnTxt}>{t("sign_in")}</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FDFBF7" },
  lang: { position: "absolute", top: 48, right: 24, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  langTxt: { fontSize: 12 },
  logo: { alignSelf: "center", width: 64, height: 64, borderRadius: 24, backgroundColor: "#0F382C", color: "#fff", textAlign: "center", lineHeight: 64, fontSize: 32 },
  title: { fontSize: 32, fontWeight: "800", textAlign: "center", marginTop: 16, color: "#0F382C" },
  sub: { textAlign: "center", color: "#475569", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "#fff" },
  btn: { backgroundColor: "#0F382C", borderRadius: 12, padding: 14, alignItems: "center", minHeight: 44 },
  btnTxt: { color: "#fff", fontWeight: "700" },
});
