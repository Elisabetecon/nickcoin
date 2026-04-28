import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { COLORS } from "../../src/theme";
import { useT } from "../../src/i18n";

export default function Recover() {
  const router = useRouter();
  const t = useT();
  const { recover } = useAuth();
  const [email, setEmail] = useState("");
  const [seed, setSeed] = useState("");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);

  const onRecover = async () => {
    if (!email || !seed || !newPass) return Alert.alert(t("error"), "Preenche todos os campos");
    setBusy(true);
    try {
      await recover(email.trim(), seed.trim(), newPass);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert(t("error"), e.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" testID="recover-screen">
        <Text style={styles.kicker}>SECURITY · BIP-39</Text>
        <Text style={styles.title}>{t("recover_title")}</Text>
        <Text style={styles.sub}>{t("recover_sub")}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t("email")}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={COLORS.textMuted} testID="recover-email" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t("seed_phrase")}</Text>
          <TextInput
            style={[styles.input, { height: 120, textAlignVertical: "top" }]}
            value={seed}
            onChangeText={setSeed}
            autoCapitalize="none"
            multiline
            placeholderTextColor={COLORS.textMuted}
            testID="recover-seed"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t("new_password")}</Text>
          <TextInput style={styles.input} value={newPass} onChangeText={setNewPass} secureTextEntry placeholderTextColor={COLORS.textMuted} testID="recover-newpass" />
        </View>

        <Pressable style={styles.primary} onPress={onRecover} disabled={busy} testID="recover-submit">
          {busy ? <ActivityIndicator color="#001018" /> : <Text style={styles.primaryText}>{t("confirm")}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 80, paddingBottom: 60 },
  kicker: { color: COLORS.primary, fontSize: 11, letterSpacing: 4, fontWeight: "700" },
  title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 12 },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 10, lineHeight: 21, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  primary: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: "#001018", fontWeight: "800", fontSize: 15, letterSpacing: 1 },
});
