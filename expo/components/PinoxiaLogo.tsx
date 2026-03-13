import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Colors from "@/constants/colors";

interface PinoxiaLogoProps {
  size?: "small" | "medium" | "large";
  showText?: boolean;
}

export default function PinoxiaLogo({ size = "medium", showText = true }: PinoxiaLogoProps) {
  const imageSize = size === "small" ? 38 : size === "large" ? 80 : 48;
  const fontSize = size === "small" ? 22 : size === "large" ? 40 : 30;

  return (
    <View style={styles.row}>
      <Image
        source={{ uri: "https://r2-pub.rork.com/generated-images/85eda0a9-9b93-439f-8fab-b0524c91a5a3.png" }}
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
