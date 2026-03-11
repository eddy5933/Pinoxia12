import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { EyeOff, Users, Globe, Shield, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { OnlineVisibility } from "@/types";
import { useOnlineStatus } from "@/providers/OnlineStatusProvider";

interface StatusOption {
  key: OnlineVisibility;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    key: "hidden",
    label: "Go Invisible",
    description: "No one can see your online status",
    icon: <EyeOff size={22} color="#FF6B6B" />,
    color: "#FF6B6B",
    bgColor: "rgba(255,107,107,0.12)",
  },
  {
    key: "friends_only",
    label: "Close Friends Only",
    description: "Only your friends can see you're online",
    icon: <Users size={22} color="#4ECDC4" />,
    color: "#4ECDC4",
    bgColor: "rgba(78,205,196,0.12)",
  },
  {
    key: "everyone",
    label: "Visible to Everyone",
    description: "All users can see your online status",
    icon: <Globe size={22} color="#45B7D1" />,
    color: "#45B7D1",
    bgColor: "rgba(69,183,209,0.12)",
  },
];

function StatusOptionRow({
  option,
  selected,
  index,
  onSelect,
}: {
  option: StatusOption;
  selected: boolean;
  index: number;
  onSelect: (key: OnlineVisibility) => void;
}) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: 150 + index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        delay: 150 + index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim, index]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(option.key);
  }, [onSelect, option.key]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <TouchableOpacity
        style={[
          styles.optionCard,
          selected && { borderColor: option.color, borderWidth: 1.5 },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
        testID={`status-option-${option.key}`}
      >
        <View style={[styles.optionIconWrap, { backgroundColor: option.bgColor }]}>
          {option.icon}
        </View>
        <View style={styles.optionTextWrap}>
          <Text style={[styles.optionLabel, selected && { color: option.color }]}>
            {option.label}
          </Text>
          <Text style={styles.optionDesc}>{option.description}</Text>
        </View>
        <ChevronRight size={18} color={selected ? option.color : Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function StatusPickerModal() {
  const { visibility, showPicker, setOnlineVisibility, closeStatusPicker } =
    useOnlineStatus();
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (showPicker) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(sheetAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sheetAnim, {
          toValue: 400,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showPicker, backdropAnim, sheetAnim]);

  const handleSelect = useCallback(
    (key: OnlineVisibility) => {
      setOnlineVisibility(key);
    },
    [setOnlineVisibility]
  );

  return (
    <Modal
      visible={showPicker}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeStatusPicker}
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeStatusPicker}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: sheetAnim }] },
          ]}
        >
          <View style={styles.handleBar} />

          <View style={styles.headerSection}>
            <View style={styles.shieldWrap}>
              <Shield size={28} color={Colors.primary} />
            </View>
            <Text style={styles.sheetTitle}>Who can see you?</Text>
            <Text style={styles.sheetSubtitle}>
              Choose your online visibility before continuing
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            {STATUS_OPTIONS.map((opt, i) => (
              <StatusOptionRow
                key={opt.key}
                option={opt}
                selected={visibility === opt.key}
                index={i}
                onSelect={handleSelect}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={closeStatusPicker}
            activeOpacity={0.7}
            testID="status-skip-button"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  sheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 12,
    maxHeight: "85%",
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: "center",
    marginBottom: 20,
  },
  headerSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  shieldWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(230,57,70,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  skipButton: {
    alignSelf: "center",
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "500" as const,
  },
});
