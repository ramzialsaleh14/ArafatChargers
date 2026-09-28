import React from "react";
import {
  Modal,
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";

const ProgressDialog = ({
  visible = false,
  title = "Loading...",
  message = "",
  cancelable = false,
  onCancel = () => {},
  indicatorColor = "#0E7C7B",
  indicatorSize = "large",
  overlayColor = "rgba(0, 0, 0, 0.45)",
  containerStyle = {},
  titleStyle = {},
  messageStyle = {},
}) => {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={cancelable ? onCancel : () => {}}
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated={Platform.OS === "android"}
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      supportedOrientations={["portrait", "landscape"]}
    >
      <StatusBar backgroundColor={overlayColor} barStyle="light-content" />
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View style={[styles.container, containerStyle]}>
          <ActivityIndicator
            size={indicatorSize}
            color={indicatorColor}
            style={styles.indicator}
            animating={true}
          />
          {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}
          {message ? (
            <Text style={[styles.message, messageStyle]}>{message}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 150,
    maxWidth: 280,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  indicator: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#123040",
    textAlign: "center",
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: "#6B7B85",
    textAlign: "center",
  },
});

export default ProgressDialog;
