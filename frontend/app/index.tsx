import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { COLORS, LOGO_URL } from "../src/theme";

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const pulse = useRef(new Animated.Value(0.7)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0.65, duration: 1100, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
  }, [pulse, scale]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (user) router.replace("/(tabs)");
      else router.replace("/(auth)/welcome");
    }, 1400);
    return () => clearTimeout(t);
  }, [loading, user, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <View style={styles.glowOuter} />
      <Animated.View style={[styles.maskWrap, { opacity: pulse, transform: [{ scale }] }]}>
        <Image source={{ uri: LOGO_URL }} style={styles.mask} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.brand}>NICKCOIN</Text>
      <Text style={styles.tag}>FUNDADO EM PORTUGAL · 2026</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glowOuter: {
    position: "absolute",
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: COLORS.primary,
    opacity: 0.07,
  },
  maskWrap: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  mask: { width: 240, height: 240 },
  brand: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 8,
    marginTop: 36,
  },
  tag: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 4,
    marginTop: 10,
  },
});
