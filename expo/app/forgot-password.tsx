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
import { Mail, Lock, ArrowLeft, KeyRound, ShieldCheck, Eye, EyeOff } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";

type Step = "email" | "otp" | "done";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetPassword, verifyOtpAndUpdatePassword } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const animateTransition = useCallback(
    (nextStep: Step) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setStep(nextStep);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim]
  );

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

  const handleSendCode = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword(email.trim());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Code Sent", "Check your email for the 6-digit recovery code.");
      animateTransition("otp");
    } catch (e: any) {
      console.log("[ForgotPassword] Send code error:", e);
      Alert.alert("Error", e?.message ?? "Failed to send reset code. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [email, resetPassword, animateTransition]);

  const handleResetPassword = useCallback(async () => {
    if (!otpCode.trim()) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyOtpAndUpdatePassword(email.trim(), otpCode.trim(), newPassword);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateTransition("done");
    } catch (e: any) {
      console.log("[ForgotPassword] Reset error:", e);
      Alert.alert("Error", e?.message ?? "Failed to reset password. Check your code and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [otpCode, newPassword, confirmPassword, email, verifyOtpAndUpdatePassword, animateTransition]);

  const stepConfig = {
    email: {
      icon: <Mail size={32} color={Colors.primary} />,
      title: "Forgot Password?",
      subtitle: "Enter your email and we'll send you a recovery code",
    },
    otp: {
      icon: <ShieldCheck size={32} color={Colors.primary} />,
      title: "Verify & Reset",
      subtitle: "Enter the code from your email and your new password",
    },
    done: {
      icon: <KeyRound size={32} color={Colors.success} />,
      title: "All Set!",
      subtitle: "Your password has been updated successfully",
    },
  };

  const current = stepConfig[step];

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
            testID="back-button"
          >
            <ArrowLeft size={24} color={Colors.white} />
          </TouchableOpacity>

          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            <View style={styles.iconCircle}>{current.icon}</View>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.subtitle}>{current.subtitle}</Text>

            {step === "email" && (
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Mail size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                    testID="forgot-email-input"
                  />
                </View>

                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                    onPress={() => void handleSendCode()}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    disabled={isSubmitting}
                    testID="send-code-button"
                  >
                    <Text style={styles.primaryButtonText}>
                      {isSubmitting ? "Sending..." : "Send Recovery Code"}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}

            {step === "otp" && (
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <ShieldCheck size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="6-digit code"
                    placeholderTextColor={Colors.textMuted}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    testID="otp-input"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Lock size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="New password"
                    placeholderTextColor={Colors.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    testID="new-password-input"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <EyeOff size={18} color={Colors.textMuted} />
                    ) : (
                      <Eye size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Lock size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor={Colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    testID="confirm-password-input"
                  />
                </View>

                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                    onPress={() => void handleResetPassword()}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    disabled={isSubmitting}
                    testID="reset-password-button"
                  >
                    <Text style={styles.primaryButtonText}>
                      {isSubmitting ? "Resetting..." : "Reset Password"}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  style={styles.resendRow}
                  onPress={() => void handleSendCode()}
                  disabled={isSubmitting}
                >
                  <Text style={styles.resendText}>
                    Didn't get the code? <Text style={styles.resendBold}>Resend</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step === "done" && (
              <View style={styles.form}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.back()}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    testID="back-to-login-button"
                  >
                    <Text style={styles.primaryButtonText}>Back to Login</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </Animated.View>
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
  stepContent: {
    marginTop: 36,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.white,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  form: {
    width: "100%",
    marginTop: 32,
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
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  resendRow: {
    alignItems: "center",
    paddingVertical: 10,
  },
  resendText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resendBold: {
    color: Colors.primary,
    fontWeight: "700" as const,
  },
});
