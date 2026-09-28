import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import * as Constants from "../utils/Constants";

/**
 * Primary action button used across the app.
 *
 * variant: "primary" | "outline" | "success" | "danger"
 */
export default function AppButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  icon = null,
  style = {},
  textStyle = {},
}) {
  const palette = {
    primary: { background: Constants.brandPrimary, border: Constants.brandPrimary, text: "#FFFFFF" },
    success: { background: Constants.brandSuccess, border: Constants.brandSuccess, text: "#FFFFFF" },
    danger: { background: Constants.brandDanger, border: Constants.brandDanger, text: "#FFFFFF" },
    outline: { background: "transparent", border: Constants.brandPrimary, text: Constants.brandPrimary },
  }[variant] || { background: Constants.brandPrimary, border: Constants.brandPrimary, text: "#FFFFFF" };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "outline" ? palette.text : "#FFFFFF"} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: palette.text }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 18,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 6,
  },
});
