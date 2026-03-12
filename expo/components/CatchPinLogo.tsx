import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MapPinned } from "lucide-react-native";
import Colors from "@/constants/colors";

interface CatchPinLogoProps {
  size?: "small" | "medium";
  showText?: boolean;
}

export default function CatchPinLogo({ size = "medium", showText = true }: CatchPinLogoProps) {
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
          <Text style={[styles.catch, { fontSize }]}>Catch</Text>
          <Text style={[styles.pin, { fontSize }]}>Pin</Text>
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
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  textRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  catch: {
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: -0.5,
  },
  pin: {
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.5,
  },
});
