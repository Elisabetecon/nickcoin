import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, Image,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../../src/auth";
import { COLORS, LOGO_URL } from "../../src/theme";
import { useT } from "../../src/i18n";

export default function Register() {
  const router = useRouter();
  const t = useT();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [busy, setBusy] = useState(false);

  const onRegister = async () => {
    if (!email || !password || !username) return Alert.alert(t("error"), "Preenche todos os campos");
    setBusy(true);
    try {
      const r = await register({
        email: email.trim(),
        password,
        username: username.trim(),
        referral_code: referral.trim() || undefined,
      });
      router.replace({ pathname: "/(auth)/seed-phrase", params: { phrase: r.seed_phrase } });
    } catch (e: any) {
      Alert.alert(t("error"), e.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" testID="register-screen">
        <Image source={{ uri: LOGO_URL }} style={styles.mask} resizeMode="contain" />
        <Text style={styles.title}>{t("register")}</Text>
        <Text style={styles.sub}>NICKCOIN · WALLET</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t("username")}</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholderTextColor={COLORS.textMuted} testID="register-username" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t("email")}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={COLORS.textMuted} testID="register-email" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t("password")}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={COLORS.textMuted} testID="register-password" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t("referral_optional")}</Text>
          <TextInput style={styles.input} value={referral} onChangeText={setReferral} autoCapitalize="characters" placeholderTextColor={COLORS.textMuted} testID="register-referral" />
        </View>

        <Pressable style={styles.primary} onPress={onRegister} disabled={busy} testID="register-submit">
          {busy ? <ActivityIndicator color="#001018" /> : <Text style={styles.primaryText}>{t("create_account")}</Text>}
        </Pressable>

        <Link href="/(auth)/login" style={styles.linkText} testID="link-login">
          {t("have_account")}
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  mask: { width: 96, height: 96, alignSelf: "center" },
  title: { color: COLORS.textPrimary, fontSize: 30, fontWeight: "700", marginTop: 24, textAlign: "center" },
  sub: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 4, textAlign: "center", marginTop: 8, marginBottom: 32 },
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
    shadowColor: COLORS.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  primaryText: { color: "#001018", fontWeight: "800", fontSize: 15, letterSpacing: 1 },
  linkText: { color: COLORS.primary, textAlign: "center", marginTop: 24, fontSize: 13, letterSpacing: 1 },
});
