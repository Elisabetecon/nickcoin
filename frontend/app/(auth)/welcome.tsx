import { View, Text, StyleSheet, Image, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { COLORS, LOGO_URL } from "../../src/theme";
import { useT } from "../../src/i18n";

export default function Welcome() {
  const router = useRouter();
  const t = useT();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={styles.container} testID="welcome-screen">
      <View style={styles.glow} />
      <Image source={{ uri: LOGO_URL }} style={styles.mask} resizeMode="contain" />
      <Text style={styles.brand}>NICKCOIN</Text>
      <Text style={styles.title}>{t("welcome_title")}</Text>
      <Text style={styles.sub}>{t("welcome_sub")}</Text>

      <View style={styles.featureBlock}>
        <Feature label="Mineração 24h sustentável" />
        <Feature label="Frase de segurança BIP-39" />
        <Feature label="Mercado em tempo real" />
        <Feature label="Carteiras digitais ligadas" />
      </View>

      <Pressable
        style={styles.primary}
        onPress={() => router.push("/(auth)/register")}
        testID="welcome-get-started"
      >
        <Text style={styles.primaryText}>{t("get_started")}</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push("/(auth)/login")} testID="welcome-have-account">
        <Text style={styles.secondaryText}>{t("have_account")}</Text>
      </Pressable>

      <Text style={styles.legal}>VASP PT-2026-0142 · MiCA · ISO/IEC 27001</Text>
    </ScrollView>
  );
}

function Feature({ label }: { label: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.dot} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, alignItems: "center", paddingBottom: 48 },
  glow: { position: "absolute", top: 40, width: 400, height: 400, borderRadius: 200, backgroundColor: COLORS.primary, opacity: 0.06 },
  mask: { width: 160, height: 160, marginTop: 8 },
  brand: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: 8, marginTop: 18 },
  title: { color: COLORS.textPrimary, fontSize: 30, fontWeight: "700", marginTop: 28, textAlign: "center", letterSpacing: -0.5 },
  sub: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },
  featureBlock: { width: "100%", marginTop: 32, gap: 14 },
  feature: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginRight: 12, shadowColor: COLORS.primary, shadowOpacity: 1, shadowRadius: 6 },
  featureText: { color: COLORS.textPrimary, fontSize: 14, letterSpacing: 0.3 },
  primary: {
    marginTop: 40,
    width: "100%",
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  primaryText: { color: "#001018", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  secondary: {
    marginTop: 12,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryText: { color: COLORS.textPrimary, fontSize: 15, letterSpacing: 0.5 },
  legal: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 2, marginTop: 36 },
});
