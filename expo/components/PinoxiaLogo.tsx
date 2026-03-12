import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MapPinned } from "lucide-react-native";
import Colors from "@/constants/colors";

interface PinoxiaLogoProps {
  size?: "small" | "medium";
  showText?: boolean;
}

export default function PinoxiaLogo({ size = "medium", showText = true }: PinoxiaLogoProps) {
  const iconBoxSize = size === "small" ? 24 : 32;
  const iconSize = size === "small" ? 13 : 18;
  const fontSize = size === "small" ? 20 : 28;
  const borderRadius = size === "small" ? 6 : 8;

  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, { width: iconBoxSize, height: iconBoxSize, borderRadius }]}>
        <MapPinned size={iconSize} color={Colors.white} />
      </View>
      {showText && (
        <View style={styles.textRow}>
          <Text style={[styles.pino, { fontSize }]}>Pino</Text>
          <Text style={[styles.xia, { fontSize }]}>xia</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  textRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  pino: {
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: -0.5,
  },
  xia: {
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.5,
  },
});
