import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Alert, Image, Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS, LOGO_URL } from "../../src/theme";
import { useT } from "../../src/i18n";

type MiningStatus = {
  active: boolean;
  session_id?: string;
  started_at?: string;
  ends_at?: string;
  remaining_seconds?: number;
  elapsed_seconds?: number;
  rate_per_hour?: number;
  earned?: number;
  complete?: boolean;
};

function fmt(sec: number) {
  if (sec <= 0) return "00:00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Mining() {
  const t = useT();
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<MiningStatus>({ active: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const pulse = useRef(new Animated.Value(0.85)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0.92, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [pulse, ring]);

  const load = useCallback(async () => {
    try {
      const s = await api<MiningStatus>("/mining/status");
      setStatus(s);
      const h = await api<{ items: any[] }>("/mining/history");
      setHistory(h.items || []);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Local ticking
  useEffect(() => {
    if (!status.active) return;
    const id = setInterval(() => {
      setStatus((s) => {
        if (!s.active || s.remaining_seconds == null) return s;
        const remaining = Math.max(0, (s.remaining_seconds || 0) - 1);
        const elapsed = (s.elapsed_seconds || 0) + 1;
        const rate = s.rate_per_hour || 0;
        const earned = Math.round((elapsed / 3600) * rate * 1e6) / 1e6;
        return { ...s, remaining_seconds: remaining, elapsed_seconds: elapsed, earned, complete: remaining === 0 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status.active]);

  const onStart = async () => {
    setBusy(true);
    try {
      const s = await api<MiningStatus>("/mining/start", { method: "POST" });
      setStatus({ ...s, active: true });
    } catch (e: any) {
      Alert.alert(t("error"), e.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  const onClaim = async () => {
    setBusy(true);
    try {
      const r = await api<{ claimed: number; currency: string }>("/mining/claim", { method: "POST" });
      Alert.alert(t("success"), `+${r.claimed} ${r.currency}`);
      await refresh();
      await load();
    } catch (e: any) {
      Alert.alert(t("error"), e.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  const onBonus = async () => {
    setBonusBusy(true);
    try {
      const r = await api<{ claimed: number; currency: string }>("/mining/daily-bonus", { method: "POST" });
      Alert.alert(t("bonus_claimed"), `+${r.claimed} ${r.currency}`);
      await refresh();
    } catch (e: any) {
      Alert.alert(t("error"), e.message || "Erro");
    } finally {
      setBonusBusy(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await load();
    setRefreshing(false);
  };

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const remaining = status.remaining_seconds ?? 0;
  const earned = status.earned ?? 0;
  const rate = status.rate_per_hour ?? 0.25;
  const isMining = !!status.active && !status.complete;
  const canClaim = !!status.active && !!status.complete;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        testID="mining-screen"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>NICKCOIN · @{user?.username}</Text>
            <Text style={styles.headerTitle}>{t("balance")}</Text>
          </View>
          <Image source={{ uri: LOGO_URL }} style={styles.headerLogo} resizeMode="contain" />
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balLabel}>{t("nkg")}</Text>
              <Text style={styles.balValue} testID="balance-nkg">{(user?.balance_nkg ?? 0).toFixed(4)}</Text>
              <Text style={styles.balUnit}>NKG</Text>
            </View>
            <View style={styles.divider} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.balLabel}>{t("beta")}</Text>
              <Text style={[styles.balValue, { color: COLORS.gold }]} testID="balance-beta">{(user?.balance_beta ?? 0).toFixed(0)}</Text>
              <Text style={styles.balUnit}>BETA</Text>
            </View>
          </View>
        </View>

        <View style={styles.miningArea}>
          <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Animated.View style={[styles.miningOuter, { transform: [{ scale: pulse }] }]}>
            <Pressable
              style={[styles.miningInner, isMining && styles.miningInnerActive]}
              onPress={canClaim ? onClaim : isMining ? undefined : onStart}
              disabled={busy || isMining}
              testID="mining-action-button"
            >
              <Image source={{ uri: LOGO_URL }} style={styles.miningMask} resizeMode="contain" />
              {busy ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10 }} />
              ) : canClaim ? (
                <Text style={styles.miningCta}>{t("claim").toUpperCase()}</Text>
              ) : isMining ? (
                <>
                  <Text style={styles.miningCountdown}>{fmt(remaining)}</Text>
                  <Text style={styles.miningRate}>{earned.toFixed(4)} NKG</Text>
                </>
              ) : (
                <Text style={styles.miningCta}>{t("start_mining").toUpperCase()}</Text>
              )}
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t("rate")} value={`${rate.toFixed(2)} NKG/h`} icon="flash" />
          <Stat label={t("remaining")} value={isMining ? fmt(remaining) : "—"} icon="time-outline" />
          <Stat label={t("mined")} value={`${earned.toFixed(3)}`} icon="trending-up" />
        </View>

        <Pressable style={styles.bonusBtn} onPress={onBonus} disabled={bonusBusy} testID="claim-daily-bonus">
          {bonusBusy ? <ActivityIndicator color={COLORS.gold} /> : (
            <>
              <Ionicons name="gift-outline" size={18} color={COLORS.gold} />
              <Text style={styles.bonusText}>  {t("claim_bonus")}</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>{t("history")}</Text>
        <View style={styles.historyBlock}>
          {history.length === 0 ? (
            <Text style={styles.empty}>{t("no_history")}</Text>
          ) : history.slice(0, 8).map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <Ionicons
                name={h.type === "mining" ? "flash" : h.type === "daily_bonus" ? "gift-outline" : "arrow-down"}
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.histType}>{h.type}</Text>
              <Text style={styles.histAmt}>+{Number(h.amount).toFixed(2)} {h.currency}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={COLORS.primary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  kicker: { color: COLORS.primary, fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "700", marginTop: 2 },
  headerLogo: { width: 48, height: 48, opacity: 0.85 },
  balanceCard: {
    marginTop: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { flexDirection: "row", alignItems: "center" },
  divider: { width: 1, height: 60, backgroundColor: COLORS.border, marginHorizontal: 12 },
  balLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2 },
  balValue: { color: COLORS.textPrimary, fontSize: 30, fontWeight: "800", marginTop: 6, letterSpacing: -0.5 },
  balUnit: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 3, marginTop: 2 },
  miningArea: {
    marginTop: 32,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: { position: "absolute", width: 240, height: 240, borderRadius: 120, borderWidth: 1, borderColor: COLORS.primary },
  miningOuter: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020F18",
    borderWidth: 1,
    borderColor: "rgba(0,180,255,0.35)",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.7,
    shadowRadius: 30,
  },
  miningInner: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  miningInnerActive: { borderColor: COLORS.primaryGlow },
  miningMask: { width: 90, height: 90, opacity: 0.95 },
  miningCta: { color: COLORS.primary, fontSize: 14, fontWeight: "800", letterSpacing: 1.5, marginTop: 10, textAlign: "center" },
  miningCountdown: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "800", marginTop: 12, letterSpacing: 1 },
  miningRate: { color: COLORS.primary, fontSize: 13, fontWeight: "600", marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: 24, gap: 10 },
  stat: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  statLabel: { color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1.5, marginTop: 6 },
  statValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 4 },
  bonusBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(229,184,106,0.4)",
    backgroundColor: "rgba(229,184,106,0.06)",
  },
  bonusText: { color: COLORS.gold, fontWeight: "700", letterSpacing: 1 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 3, marginTop: 28, marginBottom: 10, fontWeight: "700" },
  historyBlock: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  histType: { color: COLORS.textSecondary, marginLeft: 10, flex: 1, fontSize: 13 },
  histAmt: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  empty: { color: COLORS.textMuted, textAlign: "center", paddingVertical: 12 },
});
