import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking, Image, Share, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS } from "../../src/theme";
import { useT } from "../../src/i18n";

const WALLETS = [
  { name: "Trust Wallet", url: "https://trustwallet.com", icon: "https://trustwallet.com/assets/images/favicon.png", desc: "Multi-chain mobile wallet" },
  { name: "MetaMask", url: "https://metamask.io", icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg", desc: "EVM wallet & gateway" },
  { name: "Binance", url: "https://www.binance.com", icon: "https://bin.bnbstatic.com/static/images/common/favicon.ico", desc: "World's largest exchange" },
  { name: "Coinbase Wallet", url: "https://www.coinbase.com/wallet", icon: "https://www.coinbase.com/favicon.ico", desc: "Self-custody wallet" },
  { name: "Kraken", url: "https://www.kraken.com", icon: "https://www.kraken.com/favicons/favicon.ico", desc: "Pro-grade exchange" },
  { name: "Ledger", url: "https://www.ledger.com", icon: "https://www.ledger.com/favicon.ico", desc: "Hardware cold wallet" },
];

const COIN_LINKS = [
  { sym: "BTC", name: "Bitcoin", url: "https://bitcoin.org" },
  { sym: "ETH", name: "Ethereum", url: "https://ethereum.org" },
  { sym: "XRP", name: "Ripple", url: "https://xrpl.org" },
  { sym: "LTC", name: "Litecoin", url: "https://litecoin.org" },
  { sym: "UNI", name: "Uniswap", url: "https://uniswap.org" },
  { sym: "DASH", name: "Dash", url: "https://www.dash.org" },
  { sym: "DOT", name: "Polkadot", url: "https://polkadot.network" },
  { sym: "XMR", name: "Monero", url: "https://www.getmonero.org" },
  { sym: "EOS", name: "EOS", url: "https://eosnetwork.com" },
  { sym: "IOTA", name: "IOTA", url: "https://www.iota.org" },
  { sym: "ADA", name: "Cardano", url: "https://cardano.org" },
  { sym: "ZEC", name: "Zcash", url: "https://z.cash" },
  { sym: "NEM", name: "NEM", url: "https://nem.io" },
];

export default function Wallet() {
  const t = useT();
  const { user } = useAuth();
  const [refData, setRefData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<any>("/referrals");
      setRefData(r);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { Alert.alert("Erro", "Não foi possível abrir o link"); }
  };

  const share = async () => {
    try {
      await Share.share({
        message: `Junta-te à Nickcoin e ganha ${refData?.bonus_per_invite || 5} NKG. Usa o meu código: ${user?.referral_code}`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} testID="wallet-screen">
        <Text style={styles.kicker}>NICKCOIN · WALLET</Text>
        <Text style={styles.title}>{t("wallets_title")}</Text>
        <Text style={styles.sub}>{t("wallets_sub")}</Text>

        <View style={styles.referBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.referLabel}>{t("refer_code")}</Text>
            <Text style={styles.referCode} testID="referral-code">{user?.referral_code}</Text>
            <Text style={styles.referMeta}>
              {t("refer_count")}: {refData?.count ?? 0}  ·  {t("refer_bonus")}: {refData?.bonus_per_invite ?? 5} NKG
            </Text>
          </View>
          <Pressable style={styles.shareBtn} onPress={share} testID="share-invite">
            <Ionicons name="share-social" size={18} color="#001018" />
            <Text style={styles.shareTxt}>{t("invite_share")}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>CARTEIRAS LIGADAS</Text>
        <View style={styles.grid}>
          {WALLETS.map((w) => (
            <Pressable key={w.name} style={styles.walletCard} onPress={() => open(w.url)} testID={`wallet-${w.name}`}>
              <View style={styles.walletIcon}>
                <Image source={{ uri: w.icon }} style={{ width: 28, height: 28 }} resizeMode="contain" />
              </View>
              <Text style={styles.walletName}>{w.name}</Text>
              <Text style={styles.walletDesc}>{w.desc}</Text>
              <View style={styles.walletCta}>
                <Text style={styles.walletCtaText}>LIGAR</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>TROCA DE MOEDAS</Text>
        <View style={styles.coinList}>
          {COIN_LINKS.map((c) => (
            <Pressable key={c.sym} style={styles.coinRow} onPress={() => open(c.url)} testID={`coin-link-${c.sym}`}>
              <View style={styles.coinSym}><Text style={styles.coinSymText}>{c.sym}</Text></View>
              <Text style={styles.coinName}>{c.name}</Text>
              <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 60 },
  kicker: { color: COLORS.primary, fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "700", marginTop: 6 },
  sub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 },
  referBox: {
    marginTop: 20,
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    alignItems: "center",
  },
  referLabel: { color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2 },
  referCode: { color: COLORS.primary, fontSize: 22, fontWeight: "800", letterSpacing: 2, marginTop: 4 },
  referMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 6 },
  shareBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shareTxt: { color: "#001018", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 3, marginTop: 28, marginBottom: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  walletCard: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  walletIcon: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  walletName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  walletDesc: { color: COLORS.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  walletCta: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  walletCtaText: { color: COLORS.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  coinList: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  coinSym: {
    width: 48, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,180,255,0.1)", marginRight: 12,
  },
  coinSymText: { color: COLORS.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  coinName: { color: COLORS.textPrimary, fontSize: 13, flex: 1 },
});
