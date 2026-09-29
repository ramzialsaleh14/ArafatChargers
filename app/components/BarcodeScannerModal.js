import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialIcons } from "@expo/vector-icons";

import i18n from "../languages/langStrings";
import * as Commons from "../utils/Commons";
import * as Constants from "../utils/Constants";

// Charger labels carry a QR code and/or a Code 128 (1D) barcode; both are
// enabled and listed first. The remaining formats are kept as fallbacks.
const BARCODE_TYPES = [
  "qr",
  "code128",
  "code39",
  "code93",
  "codabar",
  "itf14",
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "aztec",
  "pdf417",
  "datamatrix",
];

// Give the camera a moment to run its first autofocus pass before we start
// accepting decodes - the first frames are usually too blurry to read.
const FOCUS_SETTLE_MS = 1000;

/**
 * Full screen camera modal that scans a barcode and reports the first
 * decoded value through `onScanned`.
 */
export default function BarcodeScannerModal({ visible, onScanned, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [armed, setArmed] = useState(false);
  const [mountError, setMountError] = useState("");
  const lockRef = useRef(false);
  const isArabic = Commons.isArabic();
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (visible) {
      setScanned(false);
      lockRef.current = false;
    }
    // Every time the sheet is (re)opened, start from a clean camera state.
    setTorchOn(false);
    setReady(false);
    setArmed(false);
    setMountError("");
  }, [visible]);

  // Ask for the camera permission as soon as the modal is opened.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // Wait for the first autofocus pass before accepting codes - the first frames
  // coming out of the camera are usually too blurry to decode.
  useEffect(() => {
    if (!visible || !ready) {
      return;
    }
    const timer = setTimeout(() => setArmed(true), FOCUS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [visible, ready]);

  const handleBarcodeScanned = ({ data }) => {
    if (lockRef.current || !data) {
      return;
    }
    lockRef.current = true;
    setScanned(true);
    onScanned?.(String(data).trim());
  };

  const renderBody = () => {
    if (!permission) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centered}>
          <MaterialIcons name="no-photography" size={56} color="#FFFFFF" />
          <Text style={styles.permissionTitle}>
            {i18n.t("cameraPermissionTitle")}
          </Text>
          <Text style={styles.permissionMessage}>
            {i18n.t("cameraPermissionMessage")}
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>
                {i18n.t("grantPermission")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.cameraWrapper}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          // expo-camera's FocusMode values are inverted from what the names
          // suggest:
          //   'off' -> keep focusing automatically (continuous AF)
          //   'on'  -> autofocus once, then lock the lens
          // Continuous is what a hand-held barcode scan needs, and it is the
          // native default (iOS: AVCaptureDevice.continuousAutoFocus, Android:
          // CameraX-managed focus), so native passes 'off'. The web build is
          // the exception: it maps 'off' to focusMode 'manual' (a frozen lens)
          // and 'on' to 'continuous', so web must pass 'on'.
          autofocus={isWeb ? "on" : "off"}
          // Native toggles the torch with `enableTorch`; the web implementation
          // reads it from `flash` instead.
          enableTorch={torchOn}
          flash={isWeb && torchOn ? "torch" : "off"}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onCameraReady={() => setReady(true)}
          onMountError={(event) =>
            setMountError(event?.nativeEvent?.message || i18n.t("cameraUnavailable"))
          }
          onBarcodeScanned={armed && !scanned ? handleBarcodeScanned : undefined}
        />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.reticle} pointerEvents="none">
            <View style={[styles.frame, isArabic && styles.frameRtl]} />
            <Text style={styles.hint}>
              {armed ? i18n.t("scannerHint") : i18n.t("startingCamera")}
            </Text>
          </View>

          {mountError ? <Text style={styles.mountError}>{mountError}</Text> : null}

          <TouchableOpacity
            style={[styles.torchButton, torchOn && styles.torchButtonOn]}
            onPress={() => setTorchOn((value) => !value)}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name={torchOn ? "flashlight-on" : "flashlight-off"}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.torchText}>{i18n.t("torch")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View style={styles.container}>
        <View style={[styles.header, isArabic && styles.rowReverse]}>
          <Text style={styles.headerTitle}>{i18n.t("scannerTitle")}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {renderBody()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 56 : 24,
    paddingBottom: 14,
  },
  rowReverse: {
    flexDirection: "row-reverse",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  cameraWrapper: {
    flex: 1,
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  reticle: {
    alignItems: "center",
  },
  frame: {
    width: "76%",
    height: 190,
    borderWidth: 3,
    borderColor: Constants.brandAccent,
    borderRadius: 18,
    backgroundColor: "transparent",
  },
  frameRtl: {
    // Kept for symmetry so the frame style is easy to tweak per language.
  },
  hint: {
    color: "#FFFFFF",
    marginTop: 18,
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  permissionMessage: {
    color: "#D8E3E3",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 21,
  },
  permissionButton: {
    marginTop: 22,
    backgroundColor: Constants.brandPrimary,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 14,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  torchButton: {
    position: "absolute",
    bottom: 34,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  torchButtonOn: {
    backgroundColor: Constants.brandAccent,
  },
  torchText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginHorizontal: 8,
  },
  mountError: {
    position: "absolute",
    bottom: 96,
    color: "#FFD5D5",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
