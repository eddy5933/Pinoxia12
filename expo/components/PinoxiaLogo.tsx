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
        source={{ uri: "https://r2-pub.rork.com/generated-images/11676682-2f75-48b8-9275-fdd9534abb9e.png" }}
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
