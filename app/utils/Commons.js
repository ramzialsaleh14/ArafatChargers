import { Alert, Platform, Dimensions } from "react-native";
import Toast from "react-native-root-toast";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../languages/langStrings";
import * as Constants from "./Constants";

// ---------------------------------------------------------------------------
// AsyncStorage helpers
// ---------------------------------------------------------------------------
export const saveToAS = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch (error) {
    console.log(error);
  }
};

export const getFromAS = async (key) => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.log(error);
  }
};

export const multiSaveToAS = async (pairs) => {
  try {
    await AsyncStorage.multiSet(pairs);
  } catch (error) {
    console.log(error);
  }
};

export const removeFromAS = async (key) => {
  try {
    return await AsyncStorage.removeItem(key);
  } catch (error) {
    console.log(error);
  }
};

export const getTintColor = () => (Platform.OS === "android" ? "white" : "black");

// ---------------------------------------------------------------------------
// Language helpers
// ---------------------------------------------------------------------------
export const deviceLocale = async () => {
  const stored = await getFromAS(Constants.language);
  let { locale } = await Localization.getLocalizationAsync();

  if (!locale || (!locale.startsWith("ar") && !locale.startsWith("en"))) {
    locale = "en";
  }
  return stored == null ? locale.split("-")[0] : stored;
};

export const isArabic = () => (i18n.locale || "en").startsWith("ar");

// Returns 'row-reverse' for Arabic, 'row' otherwise.
export const direction = () => (isArabic() ? "row-reverse" : "row");

// Returns the correct text alignment for the active language.
export const textAlign = () => (isArabic() ? "right" : "left");

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export const okAlert = (title, msg, cancelable = true, fnToPerform = null) => {
  Alert.alert(
    title,
    msg,
    [
      {
        text: i18n.t("ok"),
        style: "cancel",
        onPress: fnToPerform,
      },
    ],
    { cancelable }
  );
};

export const okMsgAlert = (msg, cancelable = true, fnToPerform = null) => {
  okAlert(
    Platform.OS === "android" ? "" : msg,
    Platform.OS === "android" ? msg : "",
    cancelable,
    fnToPerform
  );
};

export const confirmAlert = (title, msg, yesFn) => {
  Alert.alert(title, msg, [
    { text: i18n.t("cancel"), style: "cancel" },
    { text: i18n.t("yes"), onPress: yesFn },
  ]);
};

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
export const toast = (value, top = true, duration = Toast.durations.SHORT) => {
  Toast.show(value, {
    duration: duration,
    position: top ? Toast.positions.TOP + 72 : -42,
    shadow: true,
    animation: true,
    delay: 0,
  });
};

export const isIphoneX = () => {
  const dimen = Dimensions.get("window");
  return (
    Platform.OS === "ios" &&
    !Platform.isPad &&
    !Platform.isTVOS &&
    (dimen.height === 812 ||
      dimen.width === 812 ||
      dimen.height === 896 ||
      dimen.width === 896)
  );
};
