// UC10 alternative flow 5a — queue sessions offline, sync on reconnect.
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";

const KEY = "halaqtna_session_queue";
export const readQueue = async () => JSON.parse((await AsyncStorage.getItem(KEY)) || "[]");
export const queueSession = async (body) => AsyncStorage.setItem(KEY, JSON.stringify([...(await readQueue()), body]));

export async function flushQueue() {
  const q = await readQueue();
  const remaining = [];
  for (const body of q) {
    try { await api.post("/sessions", body); } catch (e) { if (!e.response) remaining.push(body); }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  return q.length - remaining.length;
}

export const listenForReconnect = (cb) => NetInfo.addEventListener((s) => { if (s.isConnected) cb(); });
