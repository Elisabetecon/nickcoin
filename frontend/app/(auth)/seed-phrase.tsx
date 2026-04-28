import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS } from "../../src/theme";
import { useT } from "../../src/i18n";

export default function SeedPhrase() {
  const router = useRouter();
  const t = useT();
  const { phrase } = useLocalSearchParams<{ phrase: string }>();
  const words = (phrase || "").split(/\s+/).filter(Boolean);

  const onContinue = () => {
    Alert.alert(
      t("seed_title"),
      "Confirmas que guardaste a frase em local seguro?",
      [
        { text: t("no"), style: "cancel" },
        { text: t("yes"), onPress: () => router.replace("/(tabs)") },
      ],
      { cancelable: true }
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={styles.container} testID="seed-phrase-screen">
      <View style={styles.shieldGlow} />
      <Text style={styles.kicker}>SECURITY · BIP-39</Text>
      <Text style={styles.title}>{t("seed_title")}</Text>
      <Text style={styles.sub}>{t("seed_sub")}</Text>

      <View style={styles.grid}>
        {words.map((w, i) => (
          <View key={i} style={styles.wordCell}>
            <Text style={styles.idx}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={styles.word}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={styles.warnBox}>
        <Text style={styles.warnTitle}>⚠ Atenção</Text>
        <Text style={styles.warnText}>
          Esta frase é mostrada UMA única vez. A Nickcoin nunca a pedirá. Anote em papel ou guarde num cofre offline.
        </Text>
      </View>

      <Pressable style={styles.primary} onPress={onContinue} testID="seed-acknowledge">
        <Text style={styles.primaryText}>{t("seed_ack")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, paddingBottom: 60 },
  shieldGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 220, backgroundColor: COLORS.primary, opacity: 0.04 },
  kicker: { color: COLORS.primary, fontSize: 11, letterSpacing: 4, fontWeight: "700" },
  title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 12 },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 10, lineHeight: 21 },
  grid: { marginTop: 28, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  wordCell: {
    width: "31%",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
  },
  idx: { color: COLORS.primary, fontSize: 11, marginRight: 8, fontWeight: "700" },
  word: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600", letterSpacing: 0.4 },
  warnBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(229,184,106,0.4)",
    backgroundColor: "rgba(229,184,106,0.05)",
  },
  warnTitle: { color: COLORS.gold, fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  warnText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  primary: {
    marginTop: 28,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  primaryText: { color: "#001018", fontWeight: "800", fontSize: 15, letterSpacing: 1 },
});
