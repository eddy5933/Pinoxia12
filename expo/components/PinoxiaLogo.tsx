import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Colors from "@/constants/colors";

interface PinoxiaLogoProps {
  size?: "small" | "medium" | "large";
  showText?: boolean;
}

export default function PinoxiaLogo({ size = "medium", showText = true }: PinoxiaLogoProps) {
  const imageSize = size === "small" ? 28 : size === "large" ? 64 : 36;
  const fontSize = size === "small" ? 20 : size === "large" ? 36 : 28;

  return (
    <View style={styles.row}>
      <Image
        source={require("@/assets/images/pinoxia-logo.png")}
        style={{ width: imageSize, height: imageSize }}
        contentFit="contain"
      />
      {showText && (
        <View style={styles.textRow}>
          <Text style={[styles.pino, { fontSize }]}>Pin</Text>
          <Text style={[styles.xia, { fontSize }]}>oxia</Text>
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
  textRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  pino: {
    fontWeight: "800",
    color: "#E63946",
    letterSpacing: -0.5,
  },
  xia: {
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: -0.5,
  },
});
