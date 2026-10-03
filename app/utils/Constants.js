import { Platform } from "react-native";

// ********* DON'T FORGET TO UPDATE VERSION ON WEBSERVICE *********
export const appVersion = "v1.2.3"; // ********* DON'T FORGET TO UPDATE VERSION ON WEBSERVICE *********
// ********* DON'T FORGET TO UPDATE VERSION ON WEBSERVICE *********

// ---------------------------------------------------------------------------
// Backend
// The charger service is exposed through the same "pick" gateway that the
// Arafat HR app uses. If the chargers service lives behind a different
// item_id / server, only the two values below need to change.
// ---------------------------------------------------------------------------
export const serverBaseUrl = "https://arafatmills.puresoftjo.com";
export const serverPublicBaseUrl = "https://arafatmills.puresoftjo.com";
export const serviceItemId = "HRSERVICE";

export const pickServerUrl =
  serverBaseUrl +
  "/pick/faces/redirect?item_id=" +
  serviceItemId +
  "&input_id=1&service=y&appversion=" +
  appVersion +
  "&";
export const pickPublicServerUrl =
  serverPublicBaseUrl +
  "/pick/faces/redirect?item_id=" +
  serviceItemId +
  "&input_id=1&service=y&appversion=" +
  appVersion +
  "&";

export const attachmentPath =
  serverPublicBaseUrl + "/pick/faces/attachments/ChargersApp";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
export const language = "language";
export const cur_user = "cur.user";

// ---------------------------------------------------------------------------
// Brand colors (Arafat Chargers)
// ---------------------------------------------------------------------------
export const brandPrimary = "#0E7C7B";
export const brandPrimaryDark = "#0A5C5C";
export const brandAccent = "#F2A03D";
export const brandBg = "#F2F6F6";
export const brandCard = "#FFFFFF";
export const brandText = "#123040";
export const brandMuted = "#6B7B85";
export const brandBorder = "#DCE6E6";
export const brandDanger = "#D9534F";
export const brandSuccess = "#2E9E5B";

// Kept for parity with the Arafat HR utils.
export const greenColor = brandSuccess;
export const darkBlueColor = brandText;

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------
export const networkError_code = 100;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export const CHECK_LOGIN = "CHECK.LOGIN";
export const GET_CHARGER_INFO = "GET.CHARGER.INFO";
export const SET_CHARGER_CAR = "SET.CHARGER.CAR";
export const GET_CHARGERS = "GET.CHARGERS";
export const GET_PENDING_ORDERS = "GET.PENDING.ORDERS";
export const CHANGE_PASSWORD = "CHANGE.PASSWORD";

// Small helper so screens can adapt layouts for Arabic.
export const isWeb = Platform.OS === "web";
