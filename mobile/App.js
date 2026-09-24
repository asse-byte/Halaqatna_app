// Halaqtna teacher client (React Native / Expo). UC9, UC10, UC11, UC12. Works at 360px (NFR5).
import React, { useEffect, useState } from "react";
import { I18nManager } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import LoginScreen from "./src/screens/LoginScreen";
import StudentsScreen from "./src/screens/StudentsScreen";
import AttendanceScreen from "./src/screens/AttendanceScreen";
import LogSessionScreen from "./src/screens/LogSessionScreen";
import PerformanceScreen from "./src/screens/PerformanceScreen";
import { setToken, setUnauthorizedHandler } from "./src/api";
import { LocaleProvider } from "./src/i18n";
import { flushQueue, listenForReconnect } from "./src/offline";

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    I18nManager.allowRTL(true);
    // An expired or revoked session signs the teacher out instead of failing every request.
    setUnauthorizedHandler(() => { SecureStore.deleteItemAsync("token"); setToken(null); setAuthed(false); });
    SecureStore.getItemAsync("token")
      .then((t) => { if (t) { setToken(t); setAuthed(true); flushQueue(); } })
      .finally(() => setReady(true));
    return listenForReconnect(flushQueue);
  }, []);
  if (!ready) return null;
  return (
    <LocaleProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#0F382C" }, headerTintColor: "#fff" }}>
          {!authed ? (
            <Stack.Screen name="Login" options={{ headerShown: false }}>{(p) => <LoginScreen {...p} onLogin={() => setAuthed(true)} />}</Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Students">{(p) => <StudentsScreen {...p} onLogout={() => setAuthed(false)} />}</Stack.Screen>
              {/* FR4 — the register, on its own screen rather than inside the recitation form. */}
              <Stack.Screen name="Attendance" component={AttendanceScreen} />
              <Stack.Screen name="LogSession" component={LogSessionScreen} />
              <Stack.Screen name="Performance" component={PerformanceScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </LocaleProvider>
  );
}
