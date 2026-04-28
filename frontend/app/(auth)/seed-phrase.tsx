import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS } from "../../src/theme";
import { useT } from "../../src/i18n";

export default function SeedPhrase() {
  const router = useRouter();
  const t = useT();
  const { phrase } = useLocalSearchParams<{ phrase: string }>();
  const words = (phrase || "").split(/\s+/).filter(Boolean);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const proceed = () => {
    setConfirmOpen(false);
    router.replace("/(tabs)");
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={styles.container} testID="seed-phrase-screen">
      <View style={styles.shieldGlow} />
      <Text style={styles.kicker}>SECURITY · BIP-39</Text>
      <Text style={styles.title}>{t("seed_title")}</Text>
      <Text style={styles.sub}>{t("seed_sub")}</Text>

      <View style={styles.grid}>
        {words.map((w, i) => (
          <View key={i} style={styles.wordCell} testID={`seed-word-${i + 1}`}>
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

      <Pressable style={styles.primary} onPress={() => setConfirmOpen(true)} testID="seed-acknowledge">
        <Text style={styles.primaryText}>{t("seed_ack")}</Text>
      </Pressable>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("seed_title")}</Text>
            <Text style={styles.modalBody}>Confirmas que guardaste a frase em local seguro?</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmOpen(false)} testID="seed-confirm-cancel">
                <Text style={styles.modalBtnCancelText}>{t("no")}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnOk]} onPress={proceed} testID="seed-confirm-yes">
                <Text style={styles.modalBtnOkText}>{t("yes")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  primaryText: { color: "#001018", fontWeight: "800", fontSize: 15, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: {
    width: "100%", maxWidth: 380,
    backgroundColor: "#0A0A0A",
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: "700" },
  modalBody: { color: COLORS.textSecondary, fontSize: 14, marginTop: 10, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  modalBtnCancel: { borderWidth: 1, borderColor: COLORS.border },
  modalBtnCancelText: { color: COLORS.textPrimary, fontWeight: "700" },
  modalBtnOk: { backgroundColor: COLORS.primary },
  modalBtnOkText: { color: "#001018", fontWeight: "800", letterSpacing: 1 },
});
