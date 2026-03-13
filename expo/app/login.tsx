import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, signup } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  const onPressOut = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (isSignup && !name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignup) {
        await signup(email.trim(), password, name.trim());
      } else {
        await login(email.trim(), password);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      console.log("Auth error:", e);
      const msg = e?.message ?? "Something went wrong. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, name, isSignup, login, signup, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.brandSection}>
            <Image
              source={{ uri: "https://r2-pub.rork.com/generated-images/11676682-2f75-48b8-9275-fdd9534abb9e.png" }}
              style={styles.brandLogo}
              contentFit="contain"
            />
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleRed}>Pin</Text>
              <Text style={styles.brandTitleWhite}>oxia</Text>
            </View>
            <Text style={styles.brandSubtitle}>
              {isSignup
                ? "Create your account"
                : "Welcome back"}
            </Text>
          </View>

          <View style={styles.form}>
            {isSignup && (
              <View style={styles.inputContainer}>
                <User size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  testID="name-input"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Mail size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="email-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                testID="password-input"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={18} color={Colors.textMuted} />
                ) : (
                  <Eye size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={() => void handleSubmit()}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={isSubmitting}
                testID="submit-button"
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting
                    ? "Please wait..."
                    : isSignup
                    ? "Create Account"
                    : "Sign In"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {!isSignup && (
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push("/forgot-password")}
                testID="forgot-password-button"
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignup(!isSignup)}
            >
              <Text style={styles.switchText}>
                {isSignup
                  ? "Already have an account? "
                  : "Don't have an account? "}
                <Text style={styles.switchTextBold}>
                  {isSignup ? "Sign In" : "Sign Up"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  brandSection: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: "center" as const,
  },
  brandLogo: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  brandTitleRow: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
  },
  brandTitleRed: {
    fontSize: 42,
    fontWeight: "900" as const,
    color: "#E63946",
    letterSpacing: -1,
  },
  brandTitleWhite: {
    fontSize: 42,
    fontWeight: "900" as const,
    color: Colors.white,
    letterSpacing: -1,
  },
  brandSubtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: "center" as const,
  },
  form: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  forgotButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  forgotText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  switchText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  switchTextBold: {
    color: Colors.primary,
    fontWeight: "700" as const,
  },
});
