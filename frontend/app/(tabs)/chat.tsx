import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS } from "../../src/theme";
import { useT } from "../../src/i18n";

type Msg = { id: string; user_id: string; username: string; content: string; created_at: string };

export default function Chat() {
  const t = useT();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Msg[] }>("/chat/messages?limit=80");
      setMessages(r.items);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const m = await api<Msg>("/chat/messages", { method: "POST", body: { content } });
      setMessages((prev) => [...prev, m]);
      setText("");
    } catch (e: any) {
      Alert.alert(t("error"), e.message || "Erro");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>NICKCOIN · GLOBAL</Text>
          <Text style={styles.title}>{t("chat_title")}</Text>
        </View>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={80}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("no_messages")}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            renderItem={({ item }) => {
              const mine = item.user_id === user?.id;
              return (
                <View style={[styles.msgRow, mine ? styles.msgMine : styles.msgOther]}>
                  {!mine && <Text style={styles.msgUser}>@{item.username}</Text>}
                  <Text style={styles.msgContent}>{item.content}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t("type_message")}
            placeholderTextColor={COLORS.textMuted}
            testID="chat-input"
          />
          <Pressable style={styles.sendBtn} onPress={send} disabled={sending} testID="chat-send">
            {sending ? <ActivityIndicator color="#001018" /> : <Ionicons name="send" size={18} color="#001018" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  kicker: { color: COLORS.primary, fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 2 },
  live: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  liveText: { color: COLORS.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { color: COLORS.textMuted, textAlign: "center" },
  msgRow: { padding: 12, borderRadius: 14, marginVertical: 4, maxWidth: "85%" },
  msgOther: { backgroundColor: COLORS.surface, alignSelf: "flex-start", borderWidth: 1, borderColor: COLORS.border },
  msgMine: { backgroundColor: "rgba(0,180,255,0.15)", alignSelf: "flex-end", borderWidth: 1, borderColor: COLORS.borderActive },
  msgUser: { color: COLORS.primary, fontSize: 11, fontWeight: "700", marginBottom: 4, letterSpacing: 0.5 },
  msgContent: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  inputBar: { flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg },
  input: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 24, paddingHorizontal: 16,
    paddingVertical: 12, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
});
