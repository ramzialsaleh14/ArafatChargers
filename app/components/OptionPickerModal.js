import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Constants from "../utils/Constants";
import i18n from "../languages/langStrings";

/**
 * Simple single-choice picker shown as a centred sheet.
 *
 * Used for selecting a charger id from the list returned by the service.
 */
export default function OptionPickerModal({
  visible = false,
  title = "",
  options = [],
  selectedValue = "",
  onSelect = () => {},
  onClose = () => {},
  loading = false,
  emptyText = "",
}) {
  const isArabic = (i18n.locale || "en").startsWith("ar");
  const align = { textAlign: isArabic ? "right" : "left" };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated={Platform.OS === "android"}
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={[styles.header, isArabic && styles.rowReverse]}>
            <Text style={[styles.title, styles.titleFlex, align]} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Constants.brandMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator size="small" color={Constants.brandPrimary} />
            </View>
          ) : options.length === 0 ? (
            <View style={styles.state}>
              <Text style={styles.stateText}>{emptyText}</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {options.map((option) => {
                const selected = option === selectedValue;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.option,
                      isArabic && styles.rowReverse,
                      selected && styles.optionSelected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      onSelect(option);
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        styles.optionTextFlex,
                        align,
                        selected && styles.optionTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {option}
                    </Text>
                    {selected ? (
                      <MaterialIcons
                        name="check"
                        size={20}
                        color={Constants.brandPrimary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "70%",
    backgroundColor: Constants.brandCard,
    borderRadius: 18,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#0A2A2A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  rowReverse: {
    flexDirection: "row-reverse",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Constants.brandBorder,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Constants.brandText,
  },
  titleFlex: {
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  list: {
    paddingHorizontal: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  optionSelected: {
    backgroundColor: "#E8F4F3",
  },
  optionText: {
    fontSize: 15,
    color: Constants.brandText,
  },
  optionTextFlex: {
    flex: 1,
  },
  optionTextSelected: {
    color: Constants.brandPrimary,
    fontWeight: "800",
  },
  state: {
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: "center",
  },
  stateText: {
    fontSize: 14,
    color: Constants.brandMuted,
    textAlign: "center",
  },
});
