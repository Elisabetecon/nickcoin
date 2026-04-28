import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Image, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/api";
import { COLORS } from "../../src/theme";
import { useT } from "../../src/i18n";

type Coin = {
  id: string; symbol: string; name: string; image?: string;
  price_usd: number | null; change_24h: number | null; market_cap: number | null;
};

function fmtPrice(p: number | null) {
  if (p == null) return "—";
  if (p >= 1) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${p.toFixed(6)}`;
}

function fmtChange(c: number | null) {
  if (c == null) return "—";
  return `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
}

function fmtCap(c: number | null) {
  if (c == null) return "—";
  if (c >= 1e9) return `$${(c / 1e9).toFixed(2)}B`;
  if (c >= 1e6) return `$${(c / 1e6).toFixed(2)}M`;
  return `$${c.toLocaleString()}`;
}

export default function Market() {
  const t = useT();
  const [items, setItems] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Coin[]; updated_at: string }>("/market/prices", { auth: false });
      setItems(r.items);
      setUpdated(r.updated_at);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.kicker}>NICKCOIN · MARKET</Text>
        <Text style={styles.title}>{t("market_title")}</Text>
        <Text style={styles.sub}>{t("market_sub")}{updated ? ` · ${new Date(updated).toLocaleTimeString()}` : ""}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const change = item.change_24h;
            const positive = (change ?? 0) >= 0;
            return (
              <View style={styles.row} testID={`market-row-${item.symbol}`}>
                <View style={styles.iconWrap}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={{ width: 32, height: 32 }} />
                  ) : (
                    <Text style={{ color: COLORS.primary, fontWeight: "800", fontSize: 11 }}>{item.symbol}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sym}>{item.symbol} · {fmtCap(item.market_cap)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>{fmtPrice(item.price_usd)}</Text>
                  <Text style={[styles.change, { color: positive ? COLORS.success : COLORS.danger }]}>
                    {fmtChange(change)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  kicker: { color: COLORS.primary, fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "700", marginTop: 6 },
  sub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,180,255,0.08)",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  name: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700" },
  sym: { color: COLORS.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 1 },
  price: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "800" },
  change: { fontSize: 12, marginTop: 4, fontWeight: "700" },
});
