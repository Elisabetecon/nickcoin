import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS, LOGO_URL } from "../../src/theme";
import { LANGUAGES, useT, t as tt } from "../../src/i18n";

export default function Profile() {
  const t = useT();
  const router = useRouter();
  const { user, logout, setLanguage } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);

  const onLogout = () => {
    Alert.alert(t("confirm_logout"), "", [
      { text: t("no"), style: "cancel" },
      {
        text: t("yes"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  };

  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—";
  const lang = user?.language || "pt";
  const currentLang = LANGUAGES.find((l) => l.code === lang)?.label || "Português (PT)";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} testID="profile-screen">
        <View style={styles.headCard}>
          <Image source={{ uri: LOGO_URL }} style={styles.avatar} resizeMode="contain" />
          <Text style={styles.username}>@{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.primary} />
            <Text style={styles.badgeText}>VERIFIED PIONEER</Text>
          </View>
        </View>

        <View style={styles.statBlock}>
          <Stat label={t("nkg")} value={(user?.balance_nkg ?? 0).toFixed(4)} unit="NKG" />
          <View style={styles.divider} />
          <Stat label={t("beta")} value={(user?.balance_beta ?? 0).toFixed(0)} unit="BETA" />
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="finger-print" label={t("referral_code_label")} value={user?.referral_code || "—"} />
          <InfoRow icon="calendar-outline" label={t("member_since")} value={memberSince} />
        </View>

        <Text style={styles.section}>DEFINIÇÕES</Text>
        <View style={styles.menu}>
          <MenuItem icon="globe-outline" label={t("language")} value={currentLang} onPress={() => setLangOpen(true)} testID="menu-language" />
          <MenuItem icon="information-circle-outline" label={t("about")} onPress={() => setAboutOpen(true)} testID="menu-about" />
          <MenuItem icon="document-text-outline" label={t("legal")} onPress={() => setLegalOpen(true)} testID="menu-legal" />
        </View>

        <Pressable style={styles.logout} onPress={onLogout} testID="logout-button">
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>{t("logout")}</Text>
        </Pressable>

        <Text style={styles.footerLegal}>
          NICKCOIN DIGITAL ASSETS, S.A. · NIPC PT515999142{"\n"}
          VASP PT-2026-0142 · MiCA · ISO/IEC 27001
        </Text>
      </ScrollView>

      {/* Language modal */}
      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setLangOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("language")}</Text>
            <ScrollView>
              {LANGUAGES.map((l) => (
                <Pressable
                  key={l.code}
                  style={[styles.langRow, l.code === lang && styles.langRowActive]}
                  onPress={async () => {
                    await setLanguage(l.code);
                    setLangOpen(false);
                  }}
                  testID={`lang-${l.code}`}
                >
                  <Text style={styles.langFlag}>{l.flag}</Text>
                  <Text style={styles.langLabel}>{l.label}</Text>
                  {l.code === lang && <Ionicons name="checkmark-circle" color={COLORS.primary} size={20} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* About modal */}
      <Modal visible={aboutOpen} transparent animationType="slide" onRequestClose={() => setAboutOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setAboutOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Image source={{ uri: LOGO_URL }} style={{ width: 80, height: 80, alignSelf: "center", marginBottom: 12 }} resizeMode="contain" />
            <Text style={styles.sheetTitle}>{tt(lang, "about_title")}</Text>
            <Text style={styles.sheetBody}>{tt(lang, "about_body")}</Text>

            <View style={styles.aboutGrid}>
              <AboutCell label={tt(lang, "founded")} value={tt(lang, "portugal")} />
              <AboutCell label={tt(lang, "development")} value={tt(lang, "futurist")} />
              <AboutCell label={tt(lang, "direction")} value="Elisabete Gonçalves" />
              <AboutCell label={tt(lang, "founders")} value="Elisabete Gonçalves · Nick Oliveira" />
            </View>

            <Pressable style={styles.closeBtn} onPress={() => setAboutOpen(false)}>
              <Text style={styles.closeText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Legal modal */}
      <Modal visible={legalOpen} transparent animationType="slide" onRequestClose={() => setLegalOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setLegalOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{tt(lang, "legal_title")}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.sheetBody}>{tt(lang, "legal_body")}</Text>
              <Text style={[styles.sheetBody, { marginTop: 12 }]}>
                Termos e condições · Política de privacidade · Cookie policy{"\n"}© 2026 Nickcoin Digital Assets, S.A. Todos os direitos reservados.
              </Text>
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setLegalOpen(false)}>
              <Text style={styles.closeText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuItem({ icon, label, value, onPress, testID }: any) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress} testID={testID}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <Text style={styles.menuLabel}>{label}</Text>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Pressable>
  );
}

function AboutCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutCell}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 60 },
  headCard: { alignItems: "center", paddingVertical: 16 },
  avatar: { width: 96, height: 96 },
  username: { color: COLORS.textPrimary, fontSize: 20, fontWeight: "700", marginTop: 12 },
  email: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(0,180,255,0.1)", borderWidth: 1, borderColor: COLORS.borderActive,
  },
  badgeText: { color: COLORS.primary, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  statBlock: {
    flexDirection: "row", marginTop: 16, padding: 18,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, alignItems: "center",
  },
  statLabel: { color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2 },
  statValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 6 },
  statUnit: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  divider: { width: 1, height: 50, backgroundColor: COLORS.border, marginHorizontal: 12 },
  infoCard: {
    marginTop: 14, backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 12, marginLeft: 10, flex: 1 },
  infoValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "700" },
  section: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 3, marginTop: 24, marginBottom: 10, fontWeight: "700" },
  menu: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLabel: { color: COLORS.textPrimary, fontSize: 14, flex: 1 },
  menuValue: { color: COLORS.textMuted, fontSize: 12, marginRight: 6 },
  logout: {
    marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,77,109,0.4)",
    backgroundColor: "rgba(255,77,109,0.05)",
  },
  logoutText: { color: COLORS.danger, fontWeight: "800", letterSpacing: 1 },
  footerLegal: { color: COLORS.textMuted, fontSize: 9, textAlign: "center", marginTop: 28, letterSpacing: 1.5, lineHeight: 14 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0A0A0A", padding: 20, paddingBottom: 36,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: COLORS.borderActive, maxHeight: "85%",
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.textMuted, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  sheetBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  langRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  langRowActive: { backgroundColor: "rgba(0,180,255,0.05)" },
  langFlag: { fontSize: 22 },
  langLabel: { color: COLORS.textPrimary, flex: 1, fontSize: 14 },
  closeBtn: { marginTop: 16, backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, alignItems: "center" },
  closeText: { color: "#001018", fontWeight: "800", letterSpacing: 1 },
  aboutGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, gap: 8 },
  aboutCell: {
    width: "48%", backgroundColor: "#000", padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  aboutLabel: { color: COLORS.textMuted, fontSize: 9, letterSpacing: 1.5 },
  aboutValue: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "700", marginTop: 4 },
});
