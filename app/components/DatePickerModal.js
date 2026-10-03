import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Constants from "../utils/Constants";
import * as Commons from "../utils/Commons";
import i18n from "../languages/langStrings";

const pad2 = (value) => String(value).padStart(2, "0");

// Time presets used when a day is picked: 'start' = 00:00:00, 'end' = 23:59:59.
const TIME_PRESETS = {
  start: [0, 0, 0],
  end: [23, 59, 59],
};

// Month / weekday names are hard-coded so the picker never depends on Intl
// being available in the runtime.
const MONTHS = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  ar: [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ],
};

// Sunday first, matching Date#getDay().
const WEEKDAYS = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
};

const sameDay = (a, b) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Month-grid date picker rendered as a centred sheet.
 *
 * `value` is a yyyy-MM-dd HH:mm:ss string; `onSelect` receives the same format.
 * `defaultTime` ('start' | 'end') sets the time applied when a day is picked,
 * so a "from" day defaults to 00:00:00 and a "to" day to 23:59:59.
 */
export default function DatePickerModal({
  visible = false,
  title = "",
  value = "",
  defaultTime,
  onSelect = () => {},
  onClose = () => {},
}) {
  const lang = (i18n.locale || "en").startsWith("ar") ? "ar" : "en";
  const isArabic = lang === "ar";
  const align = { textAlign: isArabic ? "right" : "left" };

  const parsed = Commons.parseDateTime(value);
  // First day of the month currently shown in the grid.
  const [viewDate, setViewDate] = useState(() => parsed || new Date());
  // Selected day (date part) plus the editable time fields.
  const [selectedDay, setSelectedDay] = useState(() => parsed || new Date());
  const [hour, setHour] = useState(() => pad2((parsed || new Date()).getHours()));
  const [minute, setMinute] = useState(() => pad2((parsed || new Date()).getMinutes()));
  const [second, setSecond] = useState(() => pad2((parsed || new Date()).getSeconds()));

  // Re-sync with the selected date every time the sheet opens.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const initial = Commons.parseDateTime(value) || new Date();
    setViewDate(initial);
    setSelectedDay(initial);
    setHour(pad2(initial.getHours()));
    setMinute(pad2(initial.getMinutes()));
    setSecond(pad2(initial.getSeconds()));
  }, [visible, value]);

  const today = new Date();

  const { cells, monthLabel, weekdayLabels } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const leading = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = [];
    for (let i = 0; i < leading; i += 1) {
      grid.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      grid.push(new Date(year, month, day));
    }
    while (grid.length % 7 !== 0) {
      grid.push(null);
    }

    return {
      cells: grid,
      monthLabel: `${MONTHS[lang][month]} ${year}`,
      weekdayLabels: WEEKDAYS[lang],
    };
  }, [viewDate, lang]);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const clampNumber = (raw, max) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    return digits ? Math.min(Number(digits), max) : 0;
  };

  // Confirms the picked day together with the entered time.
  const apply = () => {
    const date = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      clampNumber(hour, 23),
      clampNumber(minute, 59),
      clampNumber(second, 59)
    );
    onSelect(Commons.formatDateTime(date));
    onClose();
  };

  const setNow = () => {
    const now = new Date();
    setViewDate(now);
    setSelectedDay(now);
    setHour(pad2(now.getHours()));
    setMinute(pad2(now.getMinutes()));
    setSecond(pad2(now.getSeconds()));
  };

  // Picking a day also resets the time to this field's default boundary.
  const onSelectDay = (day) => {
    setSelectedDay(day);
    const preset = TIME_PRESETS[defaultTime];
    if (preset) {
      setHour(pad2(preset[0]));
      setMinute(pad2(preset[1]));
      setSecond(pad2(preset[2]));
    }
  };

  // Keeps at most two digits in the HH / MM / SS fields.
  const onTimeChange = (setter) => (text) =>
    setter(String(text).replace(/\D/g, "").slice(0, 2));

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
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={[styles.header, isArabic && styles.rowReverse]}>
            <Text style={[styles.title, styles.titleFlex, align]} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Constants.brandMuted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.monthBar, isArabic && styles.rowReverse]}>
            <TouchableOpacity style={styles.iconButton} onPress={() => shiftMonth(-1)}>
              <MaterialIcons
                name={isArabic ? "chevron-right" : "chevron-left"}
                size={26}
                color={Constants.brandPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity style={styles.iconButton} onPress={() => shiftMonth(1)}>
              <MaterialIcons
                name={isArabic ? "chevron-left" : "chevron-right"}
                size={26}
                color={Constants.brandPrimary}
              />
            </TouchableOpacity>
          </View>

          <View style={[styles.weekRow, isArabic && styles.rowReverse]}>
            {weekdayLabels.map((label, index) => (
              <View key={`wd-${index}`} style={styles.dayCell}>
                <Text style={styles.weekdayText}>{label}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[styles.weekRow, isArabic && styles.rowReverse]}
            >
              {row.map((day, colIndex) => {
                if (!day) {
                  return <View key={`empty-${rowIndex}-${colIndex}`} style={styles.dayCell} />;
                }
                const isSelected = sameDay(day, selectedDay);
                const isToday = sameDay(day, today);
                return (
                  <TouchableOpacity
                    key={Commons.formatDateTime(day)}
                    style={[
                      styles.dayCell,
                      isToday && !isSelected && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => onSelectDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isToday && !isSelected && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={[styles.timeRow, isArabic && styles.rowReverse]}>
            <Text style={styles.timeLabel}>{i18n.t("timeLabel")}</Text>
            <View style={[styles.timeInputs, isArabic && styles.rowReverse]}>
              <TextInput
                style={styles.timeInput}
                value={hour}
                onChangeText={onTimeChange(setHour)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholder="HH"
                placeholderTextColor={Constants.brandMuted}
              />
              <Text style={styles.timeColon}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={minute}
                onChangeText={onTimeChange(setMinute)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholder="MM"
                placeholderTextColor={Constants.brandMuted}
              />
              <Text style={styles.timeColon}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={second}
                onChangeText={onTimeChange(setSecond)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholder="SS"
                placeholderTextColor={Constants.brandMuted}
              />
            </View>
          </View>

          <View style={[styles.actionsRow, isArabic && styles.rowReverse]}>
            <TouchableOpacity
              style={styles.nowButton}
              activeOpacity={0.85}
              onPress={setNow}
            >
              <MaterialIcons name="schedule" size={18} color={Constants.brandPrimary} />
              <Text style={styles.nowButtonText}>{i18n.t("now")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyButton} activeOpacity={0.85} onPress={apply}>
              <Text style={styles.applyButtonText}>{i18n.t("apply")}</Text>
            </TouchableOpacity>
          </View>
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
    padding: 20,
  },
  rowReverse: {
    flexDirection: "row-reverse",
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Constants.brandCard,
    borderRadius: 18,
    padding: 12,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Constants.brandText,
  },
  titleFlex: {
    flex: 1,
  },
  iconButton: {
    padding: 4,
  },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: Constants.brandPrimary,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    height: 42,
    margin: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Constants.brandBorder,
  },
  dayCellSelected: {
    backgroundColor: Constants.brandPrimary,
  },
  dayText: {
    fontSize: 14,
    color: Constants.brandText,
  },
  dayTextToday: {
    fontWeight: "800",
    color: Constants.brandPrimary,
  },
  dayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "700",
    color: Constants.brandMuted,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Constants.brandMuted,
  },
  timeInputs: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeInput: {
    width: 46,
    height: 40,
    borderWidth: 1,
    borderColor: Constants.brandBorder,
    backgroundColor: "#F7FAFA",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: Constants.brandText,
  },
  timeColon: {
    fontSize: 16,
    fontWeight: "800",
    color: Constants.brandText,
    marginHorizontal: 4,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  nowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Constants.brandPrimary,
    marginRight: 10,
  },
  nowButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: Constants.brandPrimary,
    marginHorizontal: 6,
  },
  applyButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 12,
    backgroundColor: Constants.brandPrimary,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
